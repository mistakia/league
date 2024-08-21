import debug from 'debug'
import diff from 'deep-diff'
import path from 'path'
import { fileURLToPath } from 'url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { isMain, mergePlayer, readCSV } from '#libs-server'
import { formatPlayerName } from '#libs-shared'
// import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-duplicate-players')
debug.enable('process-duplicate-players,update-player,merge-player')

const nickname_sets = []

const get_nickname_set_indexes_for_name = (name) => {
  const nickname_set_indexes = []
  for (let i = 0; i < nickname_sets.length; i++) {
    const nickname_set = nickname_sets[i]
    if (nickname_set.includes(name)) {
      nickname_set_indexes.push(i)
    }
  }

  return nickname_set_indexes
}

const is_nicknames = (name1, name2) => {
  const nickname_set_indexes1 = get_nickname_set_indexes_for_name(name1)
  const nickname_set_indexes2 = get_nickname_set_indexes_for_name(name2)

  // find first intersection
  for (const i of nickname_set_indexes1) {
    if (nickname_set_indexes2.includes(i)) {
      return true
    }
  }

  return false
}

const jaccard_distance = (a, b) => {
  // convert to sets if arrays
  if (Array.isArray(a)) a = new Set(a)
  if (Array.isArray(b)) b = new Set(b)

  // convert to sets if strings
  if (typeof a === 'string') a = new Set(a.split(''))
  if (typeof b === 'string') b = new Set(b.split(''))

  const intersection = new Set([...a].filter((x) => b.has(x)))
  const union = new Set([...a, ...b])
  return 1 - intersection.size / union.size
}

const ngram_distance = (a, b, n = 2) => {
  const a_ngrams = []
  const b_ngrams = []

  for (let i = 0; i < a.length - n + 1; i += 1) {
    a_ngrams.push(a.slice(i, i + n))
  }

  for (let i = 0; i < b.length - n + 1; i += 1) {
    b_ngrams.push(b.slice(i, i + n))
  }

  return jaccard_distance(a_ngrams, b_ngrams)
}

const accept_diff_props = [
  'formatted',
  'pname',

  'pid',
  'current_nfl_team',
  'weight',
  'height',
  'jnum',

  'nfl_status',
  'injury_status',

  'pos',
  'pos1',
  'pos2',
  'posd',

  'dcp'
]

const compare_diff_props = ['fname', 'lname', 'col', 'dv', 'high_school']

const levenshtein_distance = (a, b) => {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix = []

  // increment along the first column of each row
  let i
  for (i = 0; i <= b.length; i += 1) {
    matrix[i] = [i]
  }

  // increment each column in the first row
  let j
  for (j = 0; j <= a.length; j += 1) {
    matrix[0][j] = j
  }

  // Fill in the rest of the matrix
  for (i = 1; i <= b.length; i += 1) {
    for (j = 1; j <= a.length; j += 1) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1
          )
        ) // deletion
      }
    }
  }

  return matrix[b.length][a.length]
}

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
      const lhs = formatPlayerName(difference.lhs)
      const rhs = formatPlayerName(difference.rhs)

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
      'player.start',
      'player.formatted',
      db.raw("CONCAT(dob, '_', start) as group_id")
    )
    .whereNot('dob', '0000-00-00')
    .whereNot('start', '0000')
    .groupBy('player.dob', 'player.start', 'player.formatted')
    .having(db.raw('COUNT(*) > 1'))
    .orderBy(db.raw('COUNT(*)'), 'desc')
    .select(db.raw('COUNT(*) as count'))

  if (formatted) {
    query.where('formatted', formatted)
  }

  const duplicates = await query

  log(`${duplicates.length} players matched on dob and start year`)

  let deleted_count = 0
  let ignore_count = 0

  for (const duplicate_player_row of duplicates) {
    const { dob, start } = duplicate_player_row
    const player_rows = await db('player').where({ dob, start })

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
          `select * from player where formatted = '${player_row.formatted}' and dob = '${player_row.dob}' and start = ${player_row.start};`
      )
  )
}

const main = async () => {
  let error
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const nicknames_csv_path = path.join(
      __dirname,
      '..',
      'data',
      'nicknames.csv'
    )
    const csv = await readCSV(nicknames_csv_path)
    for (const row of csv) {
      const nickname_set = Object.values(row)
      nickname_sets.push(nickname_set)
    }
    log(`loaded ${nickname_sets.length} nickname sets`)
    await processDuplicatePlayers({ formatted: argv.formatted })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default processDuplicatePlayers
