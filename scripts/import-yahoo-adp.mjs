import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import {
  find_player_row,
  is_main,
  report_job,
  batch_insert,
  updatePlayer,
  find_or_create_adp_format,
  yahoo
} from '#libs-server'
import { current_season } from '#constants'
import { job_types } from '#libs-shared/job-constants.mjs'
import { adp_format } from '#libs-shared'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

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
    // Yahoo reports percent_drafted as a 0-1 fraction; normalize to the 0-100
    // percent scale the other sources (ESPN/CBS/MFL) write, so the
    // player_percent_drafted data-view column is consistent across sources.
    percent_drafted:
      Number(player.player.draft_analysis.percent_drafted) * 100 || null,
    aav: Number(player.player.draft_analysis.average_cost) || null,
    projected_av: Number(player.player.projected_auction_value) || null
  }))
}

const import_yahoo_adp = async ({
  year = current_season.year,
  dry_run = false
} = {}) => {
  const raw_data = await yahoo.get_yahoo_adp()
  const players = parse_yahoo_data(raw_data)

  const adp_format_id = await find_or_create_adp_format(
    db,
    adp_format.decode_adp_type('HALF_PPR_REDRAFT')
  )

  log(`Processing Yahoo ADP data for ${year}`)

  const adp_inserts = []
  const unmatched_players = []
  const matched_yahoo_ids = new Set()

  for (const source_player of players) {
    let player_row
    try {
      player_row = await find_player_row({
        yahoo_player_id: source_player.yahoo_id
      })
    } catch (err) {
      log(`Error getting player by yahoo_id: ${err}`)
      unmatched_players.push(source_player)
      continue
    }

    if (player_row) {
      matched_yahoo_ids.add(Number(source_player.yahoo_id))
      adp_inserts.push({
        pid: player_row.pid,
        pos: player_row.primary_position,
        year,
        adp: source_player.adp,
        min_pick: null,
        max_pick: null,
        std_dev: null,
        sample_size: null,
        percent_drafted: source_player.percent_drafted,
        source_id: 'YAHOO',
        adp_format_id
      })
    } else {
      unmatched_players.push(source_player)
    }
  }

  for (const source_player of unmatched_players) {
    const player_params = {
      name: source_player.player_name,
      pos: source_player.pos,
      team: source_player.team
    }

    let player_row
    try {
      player_row = await find_player_row(player_params)
    } catch (err) {
      log(`Error getting player by name, team, pos: ${err}`)
      log(player_params)
      continue
    }

    if (player_row) {
      if (
        player_row.yahoo_player_id &&
        matched_yahoo_ids.has(Number(player_row.yahoo_player_id))
      ) {
        log(`Player ${player_row.yahoo_player_id} already matched`)
        log(source_player)
        continue
      }

      if (!player_row.yahoo_player_id) {
        await updatePlayer({
          player_row,
          update: {
            yahoo_player_id: source_player.yahoo_id
          }
        })
      }

      matched_yahoo_ids.add(Number(source_player.yahoo_id))
      adp_inserts.push({
        pid: player_row.pid,
        pos: player_row.primary_position,
        year,
        adp: source_player.adp,
        min_pick: null,
        max_pick: null,
        std_dev: null,
        sample_size: null,
        percent_drafted: source_player.percent_drafted,
        source_id: 'YAHOO',
        adp_format_id
      })
    } else {
      log(
        `Unmatched player: ${source_player.player_name} (${source_player.pos}, ${source_player.team})`
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
        await db('player_adp_index')
          .insert(batch)
          .onConflict(['year', 'source_id', 'adp_format_id', 'pid'])
          .merge()
      }
    })
    await batch_insert({
      items: adp_inserts.map((i) => ({ ...i, timestamp })),
      batch_size,
      save: async (batch) => {
        await db('player_adp_history').insert(batch)
      }
    })
  }

  log(`Unmatched players: ${unmatched_players.length}`)
  unmatched_players.forEach((source_player) => log(source_player))
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
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

if (is_main(import.meta.url)) {
  main()
}

export default import_yahoo_adp
