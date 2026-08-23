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
  grade_adp_import_run,
  summarize_adp_feed,
  espn
} from '#libs-server'
import { current_season } from '#constants'
import { job_types } from '#libs-shared/job-constants.mjs'
import { adp_format } from '#libs-shared'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-espn-adp')
debug.enable('import-espn-adp,update-player,get-player,espn')

const observed_at = new Date()
const BATCH_SIZE = 500

// TODO seperate ADP and draft rankings

const import_espn_adp = async ({
  year = current_season.year,
  dry_run = false
} = {}) => {
  const data = await espn.get_espn_adp({ year })

  const average_draft_position_format_id = await find_or_create_adp_format(
    db,
    adp_format.decode_adp_type('PPR_REDRAFT')
  )

  // The current season's payload carries `ownership` and `draftRanksByRankType`
  // on every player; historical seasons do not. Measured 2026-08-23 against the
  // per-season endpoint, a bare `player.ownership.x` threw for 2019-2022 and
  // `draftRanksByRankType.STANDARD` threw for 2023, so the script could not
  // read any season it had not just imported. Reach through optional access:
  // an absent sub-object is a player with no draft data, not a dead feed, and
  // the oracle's fill-rate rule is what decides whether too many are missing.
  const parsed_players = data.players.map((player) => ({
    espn_id: player.id,
    player_name: player.player.fullName,
    team: espn.teamId[player.player.proTeamId],
    position: espn.positionId[player.player.defaultPositionId],
    auction_value_average: player.player.ownership?.auctionValueAverage ?? null,
    // ESPN reports 0.0 for a player nobody drafted, which is a sentinel and
    // not a draft position -- 2019 answers 0.0 for all 500 players. Writing it
    // verbatim puts every undrafted player ahead of pick 1.
    average_draft_position:
      player.player.ownership?.averageDraftPosition || null,
    percent_owned: player.player.ownership?.percentOwned ?? null,
    standard_rank: player.player.draftRanksByRankType?.STANDARD?.rank ?? null,
    ppr_rank: player.player.draftRanksByRankType?.PPR?.rank ?? null,
    standard_auction_value:
      player.player.draftRanksByRankType?.STANDARD?.auctionValue ?? null,
    ppr_auction_value:
      player.player.draftRanksByRankType?.PPR?.auctionValue ?? null
  }))

  // A player the vendor publishes no draft position for does not belong in an
  // ADP index -- the row would carry nothing and read as covered. Drop them
  // BEFORE matching, so the oracle's match rate measures the population ESPN
  // actually reports on rather than its whole player universe.
  const players = parsed_players.filter(
    (player) => player.average_draft_position != null
  )
  log(
    `${players.length} of ${parsed_players.length} espn players carry a draft position`
  )

  const adp_inserts = []
  const matched_espn_ids = new Set()
  const unmatched_players = []

  // First iteration: match by espn_id
  for (const source_player of players) {
    let player_row
    try {
      player_row = await find_player_row({
        espn_player_id: source_player.espn_id
      })
    } catch (err) {
      log(`Error getting player by espn_id: ${err}`)
      unmatched_players.push(source_player)
      continue
    }

    if (player_row) {
      matched_espn_ids.add(Number(source_player.espn_id))
      adp_inserts.push({
        pid: player_row.pid,
        player_position: player_row.primary_position,
        season_year: year,
        average_draft_position: source_player.average_draft_position,
        min_pick: null,
        max_pick: null,
        standard_deviation: null,
        sample_size: null,
        percent_drafted: source_player.percent_owned,
        source_id: 'ESPN',
        average_draft_position_format_id
      })
    } else {
      unmatched_players.push(source_player)
    }
  }

  // Second iteration: match remaining players by name, team, pos
  for (const source_player of unmatched_players) {
    const player_params = {
      name: source_player.player_name,
      pos: source_player.position,
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
        player_row.espn_player_id &&
        matched_espn_ids.has(Number(player_row.espn_player_id))
      ) {
        log(`Player ${player_row.espn_player_id} already matched`)
        log(source_player)
        continue
      }

      if (!player_row.espn_player_id) {
        await updatePlayer({
          player_row,
          update: {
            espn_player_id: source_player.espn_id
          },
          source: 'espn'
        })
      }

      matched_espn_ids.add(Number(source_player.espn_id))
      adp_inserts.push({
        pid: player_row.pid,
        player_position: player_row.primary_position,
        season_year: year,
        average_draft_position: source_player.average_draft_position,
        min_pick: null,
        max_pick: null,
        standard_deviation: null,
        sample_size: null,
        percent_drafted: source_player.percent_owned,
        source_id: 'ESPN',
        average_draft_position_format_id
      })
    }
  }

  const grade = grade_adp_import_run({
    source_id: 'ESPN',
    year,
    feeds: [
      summarize_adp_feed({
        label: 'PPR_REDRAFT',
        fetched: players.length,
        rows: adp_inserts
      })
    ]
  })
  // console.log, not the debug logger: a scheduled run's verdict must not
  // depend on winning a DEBUG namespace negotiation.
  console.log(grade.summary)
  if (!grade.passed) throw new Error(grade.summary)

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
          .onConflict([
            'season_year',
            'source_id',
            'average_draft_position_format_id',
            'pid'
          ])
          .merge()
      }
    })
    await batch_insert({
      items: adp_inserts.map((i) => ({ ...i, observed_at })),
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

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default import_espn_adp
