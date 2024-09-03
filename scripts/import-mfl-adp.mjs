import fetch from 'node-fetch'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import {
  getPlayer,
  isMain,
  report_job,
  batch_insert
  // updatePlayer
} from '#libs-server'
import { constants } from '#libs-shared'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-mfl-adp')
debug.enable('import-mfl-adp,update-player,get-player')

const timestamp = Math.floor(Date.now() / 1000)
const BATCH_SIZE = 500

const fetch_mfl_data = async (url) => {
  log(`fetching ${url}`)

  const response = await fetch(url, {
    method: 'GET'
  })

  const data = await response.json()
  return data.adp.player
}

const import_mfl_adp = async ({
  year = constants.season.year,
  dry_run = false
} = {}) => {
  const adp_types = [
    {
      url: `https://api.myfantasyleague.com/${year}/export?TYPE=adp&PERIOD=RECENT&FCOUNT=12&IS_PPR=-1&IS_KEEPER=N&IS_MOCK=0&CUTOFF=10&DETAILS=&JSON=1`,
      ranking_type: 'STANDARD_REDRAFT'
    },
    {
      url: `https://api.myfantasyleague.com/${year}/export?TYPE=adp&PERIOD=RECENT&FCOUNT=12&IS_PPR=1&IS_KEEPER=N&IS_MOCK=0&CUTOFF=10&DETAILS=&JSON=1`,
      ranking_type: 'PPR_REDRAFT'
    }
  ]

  for (const { url, ranking_type } of adp_types) {
    const players = await fetch_mfl_data(url)

    const formatted_players = players.map((p) => ({
      id: Number(p.id),
      min_pick: Number(p.minPick),
      drafts_selected_in: Number(p.draftsSelectedIn),
      rank: Number(p.rank),
      draft_sel_pct: Number(p.draftSelPct),
      average_pick: Number(p.averagePick),
      max_pick: Number(p.maxPick)
    }))

    log(`Processing ${ranking_type} data`)

    const adp_inserts = []
    const unmatched_players = []
    const matched_mfl_ids = new Set()

    // First iteration: match by mfl_id
    for (const player of formatted_players) {
      let player_row
      try {
        player_row = await getPlayer({ mfl_id: player.id })
      } catch (err) {
        log(`Error getting player by mfl_id: ${err}`)
        unmatched_players.push(player)
        continue
      }

      if (player_row) {
        matched_mfl_ids.add(player.id)
        adp_inserts.push({
          pid: player_row.pid,
          pos: player_row.pos,
          week: 0,
          year,
          avg: player.average_pick,
          min: player.min_pick,
          max: player.max_pick,
          source_id: 'MFL',
          ranking_type
        })
      } else {
        unmatched_players.push(player)
      }
    }

    // Second iteration: match remaining players by name, team, pos
    // TODO retrieve player name, team, pos using id
    // for (const player of unmatched_players) {
    //   const player_params = {
    //     name: player.name,
    //     pos: player.position,
    //     team: player.team
    //   }

    //   let player_row
    //   try {
    //     player_row = await getPlayer(player_params)
    //   } catch (err) {
    //     log(`Error getting player by name, team, pos: ${err}`)
    //     log(player_params)
    //     continue
    //   }

    //   if (player_row) {
    //     if (matched_mfl_ids.has(player.id)) {
    //       log(`Player ${player.id} already matched`)
    //       continue
    //     }

    //     if (!player_row.mfl_id) {
    //       await updatePlayer({
    //         player_row,
    //         update: {
    //           mfl_id: player.id
    //         }
    //       })
    //     }

    //     matched_mfl_ids.add(player.id)
    //     adp_inserts.push({
    //       pid: player_row.pid,
    //       pos: player_row.pos,
    //       week: 0,
    //       year,
    //       avg: player.average_pick,
    //       min: player.min_pick,
    //       max: player.max_pick,
    //       source_id: 'MFL',
    //       ranking_type
    //     })
    //   } else {
    //     log(
    //       `Unmatched player: ${player.name} (${player.position}, ${player.team})`
    //     )
    //   }
    // }

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
    await import_mfl_adp({ year: argv.year, dry_run: argv.dry })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_MFL_ADP,
    error
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default import_mfl_adp
