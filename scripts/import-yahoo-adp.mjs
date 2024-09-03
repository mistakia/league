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
  yahoo
} from '#libs-server'
import { constants } from '#libs-shared'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-yahoo-adp')
debug.enable('import-yahoo-adp,update-player,get-player')

const timestamp = Math.floor(Date.now() / 1000)
const batch_size = 500

const parse_yahoo_data = (players) => {
  return players.map((player) => ({
    player_name: player.player.name.full,
    yahoo_id: Number(player.player.player_id) || null,
    team: player.player.editorial_team_abbr,
    pos: player.player.eligible_positions[0].position,
    adp: Number(player.player.draft_analysis.average_pick) || null,
    percent_drafted:
      Number(player.player.draft_analysis.percent_drafted) || null,
    aav: Number(player.player.draft_analysis.average_cost) || null,
    projected_av: Number(player.player.projected_auction_value) || null
  }))
}

const import_yahoo_adp = async ({
  year = constants.season.year,
  dry_run = false
} = {}) => {
  const raw_data = await yahoo.get_yahoo_adp()
  const players = parse_yahoo_data(raw_data)

  log(`Processing Yahoo ADP data for ${year}`)

  const adp_inserts = []
  const unmatched_players = []
  const matched_yahoo_ids = new Set()

  for (const player of players) {
    let player_row
    try {
      player_row = await getPlayer({ yahoo_id: player.yahoo_id })
    } catch (err) {
      log(`Error getting player by yahoo_id: ${err}`)
      unmatched_players.push(player)
      continue
    }

    if (player_row) {
      matched_yahoo_ids.add(Number(player.yahoo_id))
      adp_inserts.push({
        pid: player_row.pid,
        pos: player_row.pos,
        week: 0,
        year,
        avg: player.adp,
        source_id: 'YAHOO',
        ranking_type: 'HALF_PPR_REDRAFT'
      })
    } else {
      unmatched_players.push(player)
    }
  }

  for (const player of unmatched_players) {
    const player_params = {
      name: player.player_name,
      pos: player.pos,
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
      if (matched_yahoo_ids.has(Number(player.yahoo_id))) {
        log(`Player ${player.yahoo_id} already matched`)
        continue
      }

      if (!player_row.yahoo_id) {
        await updatePlayer({
          player_row,
          update: {
            yahoo_id: player.yahoo_id
          }
        })
      }

      matched_yahoo_ids.add(Number(player.yahoo_id))
      adp_inserts.push({
        pid: player_row.pid,
        pos: player_row.pos,
        week: 0,
        year,
        avg: player.adp,
        source_id: 'YAHOO',
        ranking_type: 'HALF_PPR_REDRAFT'
      })
    } else {
      log(
        `Unmatched player: ${player.player_name} (${player.pos}, ${player.team})`
      )
    }
  }

  if (dry_run) {
    log(`Dry run: ${adp_inserts.length} Yahoo ADP rankings`)
    log(adp_inserts[0])
    return
  }

  if (adp_inserts.length) {
    log(`Inserting ${adp_inserts.length} Yahoo ADP rankings into database`)
    await batch_insert({
      items: adp_inserts,
      batch_size,
      save: async (batch) => {
        await db('player_rankings_index')
          .insert(batch)
          .onConflict(['year', 'week', 'source_id', 'ranking_type', 'pid'])
          .merge()
      }
    })
    await batch_insert({
      items: adp_inserts.map((i) => ({ ...i, timestamp })),
      batch_size,
      save: async (batch) => {
        await db('player_rankings').insert(batch)
      }
    })
  }

  log(`Unmatched players: ${unmatched_players.length}`)
  unmatched_players.forEach((player) => log(player))
}

const main = async () => {
  let error
  try {
    await import_yahoo_adp({ dry_run: argv.dry, year: argv.year })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_YAHOO_ADP,
    error
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default import_yahoo_adp
