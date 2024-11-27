import debug from 'debug'

import db from '#db'
import { is_main, find_player_row, updatePlayer } from '#libs-server'
import { constants } from '#libs-shared'

const log = debug('process-nfl-plays-player')
debug.enable('process-nfl-plays-player,get-player,update-player')

const process_nfl_plays_player = async () => {
  const no_player_found = new Set()

  // load nfl_plays_player rows for current season
  const nfl_plays_player_rows = await db('nfl_plays_player')
    .join('nfl_plays', function () {
      this.on('nfl_plays_player.playId', '=', 'nfl_plays.playId')
        .andOn('nfl_plays_player.esbid', '=', 'nfl_plays.esbid')
        .andOn('nfl_plays_player.year', '=', 'nfl_plays.year')
    })
    .where({ 'nfl_plays_player.year': constants.season.year })
    .select(
      'nfl_plays_player.gsis_it_id',
      'nfl_plays_player.gsis_id',
      'nfl_plays_player.player_esbid',
      'nfl_plays_player.first_name',
      'nfl_plays_player.last_name',
      'nfl_plays.off',
      'nfl_plays.def'
    )
    .distinct()

  log(
    `loaded ${nfl_plays_player_rows.length} rows from snaps for ${constants.season.year}`
  )

  // get list of gsis_it_id missing from `player` table
  const missing_gsis_it_ids = await db('nfl_plays_player')
    .whereNotExists(function () {
      this.select('*')
        .from('player')
        .whereRaw('player.gsis_it_id = nfl_plays_player.gsis_it_id')
    })
    .where({ year: constants.season.year })
    .select('gsis_it_id')
    .distinct()

  log(
    `found ${missing_gsis_it_ids.length} missing gsis_it_ids for ${constants.season.year}`
  )

  // iterate through list and try to match to a player
  for (const { gsis_it_id } of missing_gsis_it_ids) {
    const nfl_plays_player_row = nfl_plays_player_rows.find(
      (row) => row.gsis_it_id === gsis_it_id
    )

    if (!nfl_plays_player_row) {
      log(`No data found for gsis_it_id: ${gsis_it_id}`)
      continue
    }

    let player_row

    // first try to match using gsis_id
    if (nfl_plays_player_row.gsis_id) {
      try {
        player_row = await find_player_row({
          gsisid: nfl_plays_player_row.gsis_id
        })
      } catch (err) {
        log(`Error matching player using gsis_id: ${err.message}`)
      }
    }

    // next try to match using player_esbid
    if (!player_row && nfl_plays_player_row.player_esbid) {
      try {
        player_row = await find_player_row({
          esbid: nfl_plays_player_row.player_esbid
        })
      } catch (err) {
        log(`Error matching player using player_esbid: ${err.message}`)
      }
    }

    // if no player found, use the player name and team
    if (
      !player_row &&
      nfl_plays_player_row.first_name &&
      nfl_plays_player_row.last_name
    ) {
      try {
        player_row = await find_player_row({
          name: `${nfl_plays_player_row.first_name} ${nfl_plays_player_row.last_name}`,
          teams: [
            nfl_plays_player_row.off,
            nfl_plays_player_row.def,
            'INA'
          ].filter(Boolean)
        })
      } catch (err) {
        log(`Error matching player using name and team: ${err.message}`)
      }
    }

    if (!player_row) {
      log(`No player found for gsis_it_id: ${gsis_it_id}`)
      const player_info = {
        gsis_it_id,
        name: `${nfl_plays_player_row.first_name} ${nfl_plays_player_row.last_name}`,
        esbid: nfl_plays_player_row.player_esbid,
        teams: [nfl_plays_player_row.off, nfl_plays_player_row.def].filter(
          Boolean
        )
      }
      no_player_found.add(JSON.stringify(player_info))
      continue
    }

    if (player_row.gsis_it_id) {
      log(player_row)
      log('Player already has existing gsis_it_id field')
      continue
    }

    try {
      await updatePlayer({
        player_row,
        update: {
          gsis_it_id,
          allow_protected_props: true,
          ignore_retired: true
        }
      })
    } catch (err) {
      log(`Error updating player: ${err.message}`)
    }
  }

  // Output the set of players not found
  log('Players not found:')
  no_player_found.forEach((player_info) => {
    log(JSON.parse(player_info))
  })

  log(`Total players not found: ${no_player_found.size}`)
}

const main = async () => {
  let error
  try {
    await process_nfl_plays_player()
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default process_nfl_plays_player
