import { fetch as fetch_http2 } from 'fetch-h2'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import {
  getPlayer,
  isMain,
  report_job,
  batch_insert,
  updatePlayer,
  rts
} from '#libs-server'
import { constants } from '#libs-shared'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-rts-adp')
debug.enable('import-rts-adp,update-player,get-player')

const timestamp = Math.floor(Date.now() / 1000)
const BATCH_SIZE = 500

const fetch_rts_data = async (url) => {
  log(`fetching ${url}`)

  const response = await fetch_http2(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  })

  const data = await response.json()
  return data.player_list
}

const import_rts_adp = async ({
  year = constants.season.year,
  dry_run = false
} = {}) => {
  const rts_config = await rts.get_rts_config()
  const adp_types = [
    {
      url: `${rts_config.adp_url}?NUM=250&AAV=0&STYLE=0&CHANGE=7`,
      ranking_type: 'PPR_REDRAFT'
    },
    {
      url: `${rts_config.adp_url}?NUM=250&AAV=0&STYLE=6&CHANGE=7`,
      ranking_type: 'PPR_SUPERFLEX_REDRAFT'
    },
    {
      url: `${rts_config.adp_url}?NUM=250&AAV=0&STYLE=800&CHANGE=7`,
      ranking_type: 'PPR_DYNASTY'
    }
  ]

  for (const { url, ranking_type } of adp_types) {
    const players = await fetch_rts_data(url)

    log(`Processing ${ranking_type} data`)

    const adp_inserts = []
    const unmatched_players = []
    const matched_rts_ids = new Set()

    // First iteration: match by rts_id
    for (const player of players) {
      let player_row
      try {
        player_row = await getPlayer({ rts_id: player.player_id })
      } catch (err) {
        log(`Error getting player by rts_id: ${err}`)
        unmatched_players.push(player)
        continue
      }

      if (player_row) {
        matched_rts_ids.add(Number(player.player_id))
        adp_inserts.push({
          pid: player_row.pid,
          pos: player_row.pos,
          week: 0,
          year,
          avg: Number(player.avg),
          source_id: 'RTS',
          ranking_type
        })
      } else {
        unmatched_players.push(player)
      }
    }

    // Second iteration: match remaining players by name, team, pos
    for (const player of unmatched_players) {
      const player_params = {
        name: player.name,
        pos: player.position,
        team: player.team
      }

      let player_row
      try {
        player_row = await getPlayer(player_params)
      } catch (err) {
        log(`Error getting player by name, team, pos: ${err}`)
        log(player_params)
        continue
      }

      if (player_row) {
        if (matched_rts_ids.has(Number(player.player_id))) {
          log(`Player ${player.player_id} already matched`)
          continue
        }

        if (!player_row.rts_id) {
          await updatePlayer({
            player_row,
            update: {
              rts_id: Number(player.player_id)
            }
          })
        }

        matched_rts_ids.add(Number(player.player_id))
        adp_inserts.push({
          pid: player_row.pid,
          pos: player_row.pos,
          week: 0,
          year,
          avg: Number(player.avg),
          source_id: 'RTS',
          ranking_type
        })
      } else {
        log(
          `Unmatched player: ${player.name} (${player.position}, ${player.team})`
        )
      }
    }

    if (dry_run) {
      log(`Dry run: ${adp_inserts.length} ${ranking_type} ADP rankings`)
      log(adp_inserts[0])
      continue
    }

    if (adp_inserts.length) {
      log(
        `Inserting ${adp_inserts.length} ${ranking_type} ADP rankings into database`
      )
      await batch_insert({
        items: adp_inserts,
        batch_size: BATCH_SIZE,
        save: async (batch) => {
          await db('player_rankings_index')
            .insert(batch)
            .onConflict(['year', 'week', 'source_id', 'ranking_type', 'pid'])
            .merge()
        }
      })
      await batch_insert({
        items: adp_inserts.map((i) => ({ ...i, timestamp })),
        batch_size: BATCH_SIZE,
        save: async (batch) => {
          await db('player_rankings').insert(batch)
        }
      })
    }

    log(`Unmatched players: ${unmatched_players.length}`)
    unmatched_players.forEach((player) => log(player))
  }
}

const main = async () => {
  let error
  try {
    await import_rts_adp({ dry_run: argv.dry })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_RTS_ADP,
    error
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default import_rts_adp
