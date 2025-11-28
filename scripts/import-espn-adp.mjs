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
  espn
} from '#libs-server'
import { current_season } from '#constants'
import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-espn-adp')
debug.enable('import-espn-adp,update-player,get-player,espn')

const timestamp = Math.floor(Date.now() / 1000)
const BATCH_SIZE = 500

// TODO seperate ADP and draft rankings

const import_espn_adp = async ({
  year = current_season.year,
  dry_run = false
} = {}) => {
  const data = await espn.get_espn_adp({ year })

  const players = data.players.map((player) => ({
    espn_id: player.id,
    player_name: player.player.fullName,
    team: espn.teamId[player.player.proTeamId],
    position: espn.positionId[player.player.defaultPositionId],
    auction_value_average: player.player.ownership.auctionValueAverage,
    average_draft_position: player.player.ownership.averageDraftPosition,
    percent_owned: player.player.ownership.percentOwned,
    standard_rank: player.player.draftRanksByRankType.STANDARD.rank,
    ppr_rank: player.player.draftRanksByRankType.PPR.rank,
    standard_auction_value:
      player.player.draftRanksByRankType.STANDARD.auctionValue,
    ppr_auction_value: player.player.draftRanksByRankType.PPR.auctionValue
  }))

  const adp_inserts = []
  const matched_espn_ids = new Set()
  const unmatched_players = []

  // First iteration: match by espn_id
  for (const player of players) {
    let player_row
    try {
      player_row = await find_player_row({ espn_id: player.espn_id })
    } catch (err) {
      log(`Error getting player by espn_id: ${err}`)
      unmatched_players.push(player)
      continue
    }

    if (player_row) {
      matched_espn_ids.add(Number(player.espn_id))
      adp_inserts.push({
        pid: player_row.pid,
        pos: player_row.pos,
        year,
        adp: player.average_draft_position,
        min_pick: null,
        max_pick: null,
        std_dev: null,
        sample_size: null,
        percent_drafted: player.percent_owned,
        source_id: 'ESPN',
        adp_type: 'PPR_REDRAFT'
      })
    } else {
      unmatched_players.push(player)
    }
  }

  // Second iteration: match remaining players by name, team, pos
  for (const player of unmatched_players) {
    const player_params = {
      name: player.player_name,
      pos: player.position,
      team: player.team
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
        player_row.espn_id &&
        matched_espn_ids.has(Number(player_row.espn_id))
      ) {
        log(`Player ${player_row.espn_id} already matched`)
        log(player)
        continue
      }

      if (!player_row.espn_id) {
        await updatePlayer({
          player_row,
          update: {
            espn_id: player.espn_id
          }
        })
      }

      matched_espn_ids.add(Number(player.espn_id))
      adp_inserts.push({
        pid: player_row.pid,
        pos: player_row.pos,
        year,
        adp: player.average_draft_position,
        min_pick: null,
        max_pick: null,
        std_dev: null,
        sample_size: null,
        percent_drafted: player.percent_owned,
        source_id: 'ESPN',
        adp_type: 'PPR_REDRAFT'
      })
    }
  }

  if (dry_run) {
    log(`Dry run: ${adp_inserts.length} ADP rankings`)
    log(adp_inserts[0])
    return
  }

  if (adp_inserts.length) {
    log(`Inserting ${adp_inserts.length} ADP rankings into database`)
    await batch_insert({
      items: adp_inserts,
      batch_size: BATCH_SIZE,
      save: async (batch) => {
        await db('player_adp_index')
          .insert(batch)
          .onConflict(['year', 'source_id', 'adp_type', 'pid'])
          .merge()
      }
    })
    await batch_insert({
      items: adp_inserts.map((i) => ({ ...i, timestamp })),
      batch_size: BATCH_SIZE,
      save: async (batch) => {
        await db('player_adp_history').insert(batch)
      }
    })
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    await import_espn_adp({ year: argv.year, dry_run: argv.dry })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_ESPN_ADP,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_espn_adp
