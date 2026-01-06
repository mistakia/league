import debug from 'debug'
import diff from 'deep-diff'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, mergePlayer, player_name_utils } from '#libs-server'
import {
  format_player_name,
  levenshtein_distance,
  ngram_distance
} from '#libs-shared'
// import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('process-duplicate-players')
debug.enable('process-duplicate-players,update-player,merge-player')

// Module-level cache for nickname sets (loaded in main)
let nickname_sets = []

const is_nicknames = (name1, name2) => {
  return player_name_utils.is_nicknames_sync(name1, name2, nickname_sets)
}

const accept_diff_props = [
  'formatted',
  'pname',

  'pid',
  'current_nfl_team',
  'weight',
  'height',
  'jnum',

  'roster_status',
  'game_designation',

  'pos',
  'pos1',
  'pos2',
  'posd',

  'dcp'
]

const compare_diff_props = ['fname', 'lname', 'col', 'dv', 'high_school']

const unresolvable_differences = (a, b) => {
  const differences = diff(a, b)
  const filtered_differences = differences.filter((difference) => {
    if (difference.lhs && !difference.rhs) {
      return false
    }

    if (difference.rhs && !difference.lhs) {
      return false
    }

    if (accept_diff_props.includes(difference.path[0])) {
      return false
    }

    if (compare_diff_props.includes(difference.path[0])) {
      // normalize names, compare and check for shortening
      const lhs = format_player_name(difference.lhs)
      const rhs = format_player_name(difference.rhs)

      if (lhs === rhs) {
        return false
      }

      if (lhs.includes(rhs) || rhs.includes(lhs)) {
        return false
      }

      // compare levenstein distance, factor in length
      const l_distance = levenshtein_distance(lhs, rhs)
      const l_distance_ratio = l_distance / Math.max(lhs.length, rhs.length)
      if (l_distance_ratio <= 0.3) {
        log(`levenshtein_distance(${lhs}, ${rhs}) = ${l_distance}`)
        return false
      }

      // // compare jacard distance
      // const j_distance = jaccard_distance(lhs, rhs)
      // if (j_distance <= 0.5) {
      //   log(`jaccard_distance(${lhs}, ${rhs}) = ${j_distance}`)
      //   return false
      // }

      // compare ngram distance
      const n_distance = ngram_distance(lhs, rhs)
      if (n_distance <= 0.4) {
        log(`ngram_distance(${lhs}, ${rhs}) = ${n_distance}`)
        return false
      }

      // for first name check if they could be nicknames
      if (difference.path[0] === 'fname') {
        if (is_nicknames(lhs, rhs)) {
          return false
        }

        if (l_distance < 3) {
          return false
        }

        if (l_distance_ratio < 0.5) {
          return false
        }

        if (n_distance < 0.5) {
          return false
        }
      }
    }

    return true
  })

  return filtered_differences
}

const processDuplicatePlayers = async ({ formatted = null } = {}) => {
  const query = db('player')
    .select(
      'player.dob',
      'player.nfl_draft_year',
      'player.formatted',
      db.raw("CONCAT(dob, '_', nfl_draft_year) as group_id")
    )
    .whereNot('dob', '0000-00-00')
    .whereNot('nfl_draft_year', '0000')
    .groupBy('player.dob', 'player.nfl_draft_year', 'player.formatted')
    .having(db.raw('COUNT(*) > 1'))
    .orderBy(db.raw('COUNT(*)'), 'desc')
    .select(db.raw('COUNT(*) as count'))

  if (formatted) {
    query.where('formatted', formatted)
  }

  const duplicates = await query

  log(`${duplicates.length} players matched on dob and nfl_draft_year`)

  let deleted_count = 0
  let ignore_count = 0

  for (const duplicate_player_row of duplicates) {
    const { dob, nfl_draft_year } = duplicate_player_row
    const player_rows = await db('player').where({ dob, nfl_draft_year })

    // iterate over player_rows finding any two rows that can be merged
    for (let i = 0; i < player_rows.length; i += 1) {
      const player_row = player_rows[i]

      for (let j = i + 1; j < player_rows.length; j += 1) {
        const other_player_row = player_rows[j]

        const differences = unresolvable_differences(
          player_row,
          other_player_row
        )
        if (differences.length) {
          log(
            `unexpected differences between ${player_row.fname} ${
              player_row.lname
            } and ${other_player_row.fname} ${
              other_player_row.lname
            }: ${differences.map((d) => d.path[0]).join(', ')}`
          )
          ignore_count += 1
          continue
        }

        // merge player_row and other_player_row
        await mergePlayer({
          update_player_row: player_row,
          remove_player_row: other_player_row
        })
        deleted_count += 1

        // remove other_player_row from player_rows
        player_rows.splice(j, 1)

        // decrement j to account for removed player_row
        j -= 1
      }
    }
  }

  log(`deleted ${deleted_count} player rows`)
  log(`ignored ${ignore_count} duplicate player rows`)

  // top 10 duplicate players
  log(
    duplicates
      .slice(0, 10)
      .map(
        (player_row) =>
          `select * from player where formatted = '${player_row.formatted}' and dob = '${player_row.dob}' and nfl_draft_year = ${player_row.nfl_draft_year};`
      )
  )
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    nickname_sets = await player_name_utils.load_nickname_sets()
    log(`loaded ${nickname_sets.length} nickname sets`)
    await processDuplicatePlayers({ formatted: argv.formatted })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default processDuplicatePlayers
