import debug from 'debug'
import diff from 'deep-diff'

import db from '#db'
import { isMain, mergePlayer } from '#utils'

const log = debug('process-duplicate-players')
debug.enable('process-duplicate-players,update-player')

const processDuplicatePlayers = async () => {
  const duplicates = await db('player')
    .select(
      'player.*',
      db.raw('CONCAT(formatted, "__", dob, "__", start) as "group_id"')
    )
    .count('* as count')
    .groupBy('group_id')
    .having('count', '>', 1)
    .orderBy('count', 'desc')

  log(`${duplicates.length} players had duplicates`)

  const accept_diff_props = [
    'lname',
    'pname',

    'pid',
    'cteam',
    'weight',
    'height',
    'jnum',

    'nfl_status',
    'status',
    'injury_status',

    'pos',
    'pos1',
    'pos2',
    'posd',

    'forty',
    'bench',
    'vertical',
    'broad',
    'shuffle',
    'cone',
    'arm',
    'hand',

    'dcp',

    'col',
    'div',
    'high_school'
  ]

  let deleted_count = 0
  let ignore_count = 0

  for (const duplicate_player_row of duplicates) {
    const { formatted, dob, start } = duplicate_player_row
    const player_rows = await db('player').where({ formatted, dob, start })

    const selected_player_row = player_rows[0]

    const filtered_player_rows = player_rows.slice(1).filter((player_row) => {
      const differences = diff(selected_player_row, player_row)

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

        return true
      })

      // ignore duplicate rows with unexpected differences
      if (filtered_differences.length) {
        ignore_count += 1
        return false
      }

      return true
    })

    for (const player_row of filtered_player_rows) {
      await mergePlayer({
        update_player_row: selected_player_row,
        remove_player_row: player_row
      })
      deleted_count += 1
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
    await processDuplicatePlayers()
  } catch (err) {
    error = err
    log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.EXAMPLE,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default processDuplicatePlayers
