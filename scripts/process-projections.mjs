import debug from 'debug'
import dayjs from 'dayjs'
import dayOfYear from 'dayjs/plugin/dayOfYear.js'

import db from '#db'
import {
  groupBy,
  Roster,
  weightProjections,
  weight_season_projections,
  calculate_season_projection_values,
  calculate_weekly_projection_values,
  calculate_player_period_values,
  named_scoring_formats,
  named_league_formats
} from '#libs-shared'
import {
  current_season,
  external_data_sources,
  create_empty_projected_fantasy_stats
} from '#constants'
import {
  get_league_format,
  get_player_projections,
  get_season_projections,
  getPlayers,
  getRoster,
  getLeague,
  get_player_transactions,
  is_main,
  batch_insert,
  report_job,
  simulation,
  emit_signal,
  record_league_format_projection_value_history,
  build_league_format_period_inserts,
  check_season_projections_consensus,
  read_season_consensus_baseline
} from '#libs-server'
import project_lineups from './project-lineups.mjs'
import calculateMatchupProjection from './calculate-matchup-projection.mjs'
import calculatePlayoffMatchupProjection from './calculate-playoff-matchup-projection.mjs'
import { process_scoring_format_year } from './process-projections-for-scoring-format.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import first_projection_week_to_recompute from '#libs-shared/first-projection-week-to-recompute.mjs'
import { season_aggregate_key } from '#libs-shared/calculate-distributional-baselines.mjs'
import { rest_of_season_aggregate_key } from '#libs-shared/calculate-player-period-values.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

dayjs.extend(dayOfYear)

const log = debug('process-projections')
enable_debug_namespaces(
  'process-projections,project-lineups,simulation:*,calculate-matchup-projection,record-league-format-projection-value-history'
)

// Both consumers are timestamptz: league_team_forecast.generated_at and
// leagues.processed_at.
const timestamp = new Date()

/**
 * Run season forecast simulation and save results.
 * Uses the new player-level correlation simulation system.
 */
export const run_season_forecast = async (lid) => {
  if (isNaN(lid)) {
    log('Skipping season forecast - invalid lid')
    return
  }

  const year = current_season.year
  let forecast_result

  // No catch here. simulate_season_forecast stopped fabricating a 50/50 result
  // for a week it could not simulate and now throws, on the reasoning that no
  // substitute outcome is acceptable -- and a catch that logs and returns puts
  // that fix straight back to sleep, because this script's only real surface is
  // the pipeline_failure signal main() emits. The cron line runs bare node with
  // no job-wrapper and main() ends in a bare process.exit(), so the exit code
  // reaches nobody; rethrowing to it would surface nothing. run() already wraps
  // each league in its own try/catch and collects the failure with
  // stage 'process_league', which feeds that one signal. Let it propagate.
  const league = await getLeague({ lid, year })
  if (!league) {
    // run() only calls this for hosted leagues, so a missing league row is a
    // broken invariant rather than a league with nothing to forecast.
    throw new Error(`League ${lid} not found, cannot run forecast`)
  }

  const wildcard_round = league.wildcard_round
  const championship_round = league.championship_round || []
  const championship_start_week =
    championship_round.length > 0 ? championship_round[0] : null

  if (current_season.week <= current_season.regular_season_final_week) {
    log(`Running season forecast for league ${lid}`)
    forecast_result = await simulation.simulate_season_forecast({
      league_id: lid,
      year
    })
  } else if (wildcard_round && current_season.week === wildcard_round) {
    log(`Running wildcard forecast for league ${lid} (week ${wildcard_round})`)
    forecast_result = await simulation.simulate_wildcard_forecast({
      league_id: lid,
      year
    })
  } else if (
    championship_start_week &&
    current_season.week >= championship_start_week &&
    current_season.week <= current_season.final_week
  ) {
    log(
      `Running championship forecast for league ${lid} (starting week ${championship_start_week})`
    )
    forecast_result = await simulation.simulate_championship_forecast({
      league_id: lid,
      year
    })
  } else {
    log('No forecast to run - season complete')
    return
  }

  // Save forecast results to database
  const forecastInserts = []
  for (const [tid, forecast] of Object.entries(forecast_result)) {
    forecastInserts.push({
      tid: Number(tid),
      lid,
      week: current_season.week,
      season_year: year,
      day: dayjs().dayOfYear(),
      playoff_odds: forecast.playoff_odds,
      division_odds: forecast.division_odds,
      bye_odds: forecast.bye_odds,
      championship_odds: forecast.championship_odds,
      generated_at: timestamp
    })
  }

  if (forecastInserts.length) {
    await db('league_team_forecast')
      .insert(forecastInserts)
      .onConflict(['tid', 'season_year', 'week', 'day'])
      .merge()
    log(`Saved ${forecastInserts.length} team forecasts`)
  }
}

// The AVERAGE (source_id 18) consensus is deliberately CURRENT-STATE ONLY. It is
// written to projections_index (and rest_of_season_projections) and NOT to
// projections_history. This is a decision, not an oversight: giving it a real
// generated_at at the hourly cadence this script runs at would append ~184M
// rows/year to projections_history, and the consensus is exactly derivable from
// the per-source history that already exists there.
//
// To reconstruct the consensus as of some instant D, take the latest observation
// of each real source at or before D and re-run weightProjections over it:
//
//   SELECT DISTINCT ON (source_id, pid, week, season_year, season_type) *
//   FROM projections_history
//   WHERE generated_at <= D
//   ORDER BY source_id, pid, week, season_year, season_type, generated_at DESC
//
// See user:text/league/projection-history-system.md for the full rationale.
const process_average_projections = async ({ year, seas_type = 'REG' }) => {
  log(`processing projections for year ${year} and seas_type ${seas_type}`)
  const projections = await get_player_projections({
    season_year: year,
    season_type: seas_type
  })
  log(`fetched ${projections.length} projections`)
  // The season-long consensus reads its own table. It carries no week column, so
  // there is no floor for the preseason clock to step past and no predicate that
  // could amputate it -- which is the 2026-08-04 failure made structurally
  // unavailable rather than guarded against.
  //
  // POST runs skip it: a season-long projection is a REG quantity, and
  // `season_projections_index` has no `season_type` column to hold anything else.
  const write_season_period =
    seas_type === 'REG' &&
    (current_season.is_offseason || year !== current_season.year)
  const season_projections = write_season_period
    ? await get_season_projections({ season_year: year })
    : []
  log(`fetched ${season_projections.length} season projections`)
  const season_projections_by_pid = groupBy(season_projections, 'pid')

  const projections_by_pid = groupBy(projections, 'pid')
  const projection_pids = Object.keys(projections_by_pid)

  const player_rows = await db('player').whereIn('pid', projection_pids)

  const weekly_projection_inserts = []
  const season_projection_inserts = []
  const rest_of_season_projection_inserts = []

  for (const player_row of player_rows) {
    const projections = projections_by_pid[player_row.pid] || []
    player_row.projection = {}

    // For POST season, only process the current playoff week
    if (seas_type === 'POST') {
      const week = current_season.nfl_seas_week
      player_row.projection[week] = {}

      const projection = weightProjections({
        projections,
        week
      })

      player_row.projection[week] = projection
      weekly_projection_inserts.push({
        pid: player_row.pid,
        source_id: external_data_sources.AVERAGE,
        season_type: seas_type,
        season_year: current_season.year,
        week,
        ...projection
      })
      continue
    }

    // The SEASON-LONG consensus, from its own table and under its own key.
    // Written every run through the offseason and sealed once week 1 opens, on
    // the same condition as the valuation board -- and, like it, no longer a
    // by-product of where the weekly loop happens to start.
    if (write_season_period) {
      const season_projection = weight_season_projections({
        projections: season_projections_by_pid[player_row.pid] || []
      })
      player_row.projection[season_aggregate_key] = season_projection
      season_projection_inserts.push({
        pid: player_row.pid,
        source_id: external_data_sources.AVERAGE,
        season_year: current_season.year,
        ...season_projection
      })
    }

    // Regular season processing
    let week = first_projection_week_to_recompute({ year })
    for (; week <= current_season.nfl_final_week; week++) {
      player_row.projection[week] = {}

      // average projection
      const projection = weightProjections({
        projections,
        week
      })

      player_row.projection[week] = projection
      weekly_projection_inserts.push({
        pid: player_row.pid,
        source_id: external_data_sources.AVERAGE,
        season_type: seas_type,
        season_year: current_season.year,
        week,
        ...projection
      })
    }

    // Only calculate rest-of-season projections for regular season
    if (seas_type === 'REG') {
      const rest_of_season = create_empty_projected_fantasy_stats()
      // A stat no source has an opinion on is null for every week, and summing
      // nulls into the zero-initialized accumulator would re-fabricate the
      // consensus weightProjections just stopped inventing. Track which stats
      // any week actually spoke to and null the rest back out.
      const rest_of_season_has_opinion = {}
      let proj_wks = 0
      for (const [week, projection] of Object.entries(player_row.projection)) {
        // `Number(week)` drops the named period keys -- 'season' here, and
        // 'rest_of_season' once it is assigned below -- in the same test that
        // used to need an explicit `week !== '0'` for the sentinel. Summing a
        // season row into the rest-of-season accumulator would double the board.
        if (Number(week) && week >= current_season.week) {
          proj_wks += 1
          for (const [key, value] of Object.entries(projection)) {
            if (value === null || value === undefined) continue
            rest_of_season[key] += value
            rest_of_season_has_opinion[key] = true
          }
        }
      }
      for (const key of Object.keys(rest_of_season)) {
        if (!rest_of_season_has_opinion[key]) rest_of_season[key] = null
      }

      player_row.proj_wks = proj_wks
      player_row.projection.rest_of_season = rest_of_season

      rest_of_season_projection_inserts.push({
        pid: player_row.pid,
        source_id: external_data_sources.AVERAGE,
        season_year: current_season.year,
        ...rest_of_season
      })
    }
  }

  if (weekly_projection_inserts.length) {
    log(`processing ${weekly_projection_inserts.length} projections`)

    await batch_insert({
      items: weekly_projection_inserts,
      save: (items) =>
        db('projections_index')
          .insert(items)
          .onConflict([
            'source_id',
            'pid',
            'week',
            'season_year',
            'season_type'
          ])
          .merge(),
      batch_size: 100
    })
    log(`processed and saved ${weekly_projection_inserts.length} projections`)
  }

  if (season_projection_inserts.length) {
    log(`processing ${season_projection_inserts.length} season projections`)

    await batch_insert({
      items: season_projection_inserts,
      save: (items) =>
        db('season_projections_index')
          .insert(items)
          .onConflict(['source_id', 'pid', 'season_year'])
          .merge(),
      batch_size: 100
    })
    log(
      `processed and saved ${season_projection_inserts.length} season projections`
    )
  }

  if (rest_of_season_projection_inserts.length) {
    log(
      `processing ${rest_of_season_projection_inserts.length} rest of season projections`
    )

    await batch_insert({
      items: rest_of_season_projection_inserts,
      save: (items) =>
        db('rest_of_season_projections')
          .insert(items)
          .onConflict(['source_id', 'pid', 'season_year'])
          .merge(),
      batch_size: 100
    })
    log(
      `processed and saved ${rest_of_season_projection_inserts.length} rest of season projections`
    )
  }

  return player_rows
}

const process_league_format = async ({
  projection_pids,
  year,
  league_format_id,
  pricing_model = 'auction'
}) => {
  log(`processing league format ${league_format_id} (${pricing_model})`)
  const league_format = await get_league_format({ league_format_id })
  if (!league_format) {
    throw new Error(`league format ${league_format_id} not found`)
  }

  const player_rows = await getPlayers({
    pids: projection_pids,
    league_format_id: league_format.league_format_id,
    scoring_format_id: league_format.scoring_format_id
  })

  // The season board runs ONCE, before the weekly loop and outside it -- it is
  // the expensive distributional pass, and it is a period rather than a week.
  // Gated on the seal: recompute it through the offseason, stop touching it once
  // week 1 opens, and always rebuild it for a completed past season.
  const write_season_period =
    current_season.is_offseason || year !== current_season.year
  if (write_season_period) {
    calculate_season_projection_values({
      players: player_rows,
      league: league_format
    })
  }

  // The baselines this loop computes are not persisted for a league FORMAT --
  // only process_league writes league_baselines, and it computes its own.
  for (
    let week = first_projection_week_to_recompute({ year });
    week <= current_season.nfl_final_week;
    week++
  ) {
    calculate_weekly_projection_values({
      players: player_rows,
      league: league_format,
      week
    })
  }

  // After the weekly loop, never inside it: both period nets are sums over the
  // weekly boards above.
  calculate_player_period_values({
    players: player_rows,
    league: league_format
  })

  const {
    weekly_value_inserts,
    season_value_inserts,
    rest_of_season_value_inserts
  } = build_league_format_period_inserts({
    player_rows,
    league_format_id,
    season_year: current_season.year,
    write_season_period
  })

  // Record the dated observations BEFORE the destructive rewrites below. The
  // current-state tables are delete-then-reinsert, so history has to be captured
  // from the computed values rather than read back afterwards.
  if (weekly_value_inserts.length || rest_of_season_value_inserts.length) {
    await record_league_format_projection_value_history({
      league_format_id,
      year: current_season.year,
      weekly_value_rows: weekly_value_inserts,
      rest_of_season_value_rows: rest_of_season_value_inserts
    })
  }

  if (weekly_value_inserts.length) {
    // Scoped to the year being rewritten. This delete was previously unscoped and
    // wiped every prior season's values for the format on each hourly run, while
    // the reinsert below only ever restores current_season.year.
    await db('league_format_player_projection_values')
      .del()
      .where({ league_format_id, season_year: current_season.year })
    await batch_insert({
      items: weekly_value_inserts,
      save: (items) =>
        db('league_format_player_projection_values').insert(items),
      batch_size: 100
    })
    log(`processed and saved ${weekly_value_inserts.length} weekly values`)
  }

  if (season_value_inserts.length) {
    await db('league_format_player_season_projection_values')
      .del()
      .where({ league_format_id, season_year: current_season.year })
    await batch_insert({
      items: season_value_inserts,
      save: (items) =>
        db('league_format_player_season_projection_values').insert(items),
      batch_size: 100
    })
    log(`processed and saved ${season_value_inserts.length} season values`)
  }

  if (rest_of_season_value_inserts.length) {
    await db('league_format_player_rest_of_season_projection_values')
      .del()
      .where({ league_format_id, season_year: current_season.year })
    await batch_insert({
      items: rest_of_season_value_inserts,
      save: (items) =>
        db('league_format_player_rest_of_season_projection_values').insert(
          items
        ),
      batch_size: 100
    })
    log(
      `processed and saved ${rest_of_season_value_inserts.length} rest of season values`
    )
  }
}

const process_league = async ({ year, lid }) => {
  // The ROSTER week, deliberately not the projection recompute floor. The two
  // used to be one variable, which was only ever correct by coincidence: the
  // floor now starts at 1 because week 0 is not a projection week, while a
  // roster snapshot in the offseason genuinely IS week 0 and `rosters` keeps
  // using 0 for it. Reading the floor here would have silently moved every
  // offseason roster lookup to week 1 and found no rows.
  //
  // `current_season.week` rather than `fantasy_season_week`: the guard below
  // relies on this growing past `final_week` once the season ends, which is how
  // the roster block stops running. `fantasy_season_week` returns to 0 there and
  // would restart it.
  const roster_week = current_season.week

  const league = await getLeague({ lid })
  const teams = await db('teams').where({ lid, season_year: year })
  // min_bid here prices unused roster space, not the board -- unrelated to the
  // discretionary cap calculatePrices derives.
  const { min_bid } = league
  let league_available_salary_space = 0

  // initialize roster rows
  const rosterRows = []
  const rostered_pids = []

  // check to see if it is past the fantasy season
  if (roster_week <= current_season.final_week) {
    for (const team of teams) {
      const rosterRow = await getRoster({
        tid: team.team_id,
        week: roster_week
      })
      rosterRows.push(rosterRow)
      rosterRow.players.forEach((p) => rostered_pids.push(p.pid))
      const roster = new Roster({ roster: rosterRow, league })
      const team_available_salary_space =
        roster.availableCap - min_bid * roster.availableSpace
      if (team_available_salary_space > 0) {
        league_available_salary_space =
          league_available_salary_space + team_available_salary_space
      }

      team._roster_row = rosterRow
      team._roster = roster
    }
  }

  // get projections for current week
  const projections = await get_player_projections()

  const projections_by_pid = groupBy(projections, 'pid')
  const projection_pids = Object.keys(projections_by_pid)

  const player_rows = await getPlayers({
    pids: projection_pids.concat(rostered_pids),
    leagueId: lid,
    scoring_format_id: league.scoring_format_id
  })

  const transactions = await get_player_transactions({
    lid,
    pids: rostered_pids
  })

  // update player rows with current salary
  for (const tran of transactions) {
    const player_row = player_rows.find((p) => p.pid === tran.pid)
    player_row.player_salary = tran.player_salary
  }

  // Same split as process_league_format: the season board once, then the weekly
  // loop. Its baselines land under the named period key rather than a reserved
  // week number, which is what the persist loop below partitions on.
  const baselines = {}
  if (current_season.is_offseason || year !== current_season.year) {
    const { baselines: season_baselines } = calculate_season_projection_values({
      players: player_rows,
      league
    })
    baselines[season_aggregate_key] = season_baselines
  }
  for (
    let week = first_projection_week_to_recompute({ year });
    week <= current_season.nfl_final_week;
    week++
  ) {
    const { baselines: week_baselines } = calculate_weekly_projection_values({
      players: player_rows,
      league,
      rosterRows,
      week
    })
    baselines[week] = week_baselines
  }

  // After the weekly loop, never inside it: both period nets are sums over the
  // weekly boards above.
  calculate_player_period_values({
    players: player_rows,
    league
  })

  let league_available_pts_added = 0
  for (const player_row of player_rows) {
    const is_available = !rostered_pids.includes(player_row.pid)
    const season_pts_added = player_row.pts_added[season_aggregate_key]
    if (is_available && season_pts_added > 0) {
      league_available_pts_added = league_available_pts_added + season_pts_added
    }
  }

  const valueInserts = []
  const season_value_inserts = []
  const rest_of_season_value_inserts = []
  for (const player_row of player_rows) {
    if (!projection_pids.includes(player_row.pid)) {
      continue
    }

    const is_available = !rostered_pids.includes(player_row.pid)
    const league_adjusted_rate = is_available
      ? league_available_salary_space / league_available_pts_added
      : (league_available_salary_space + player_row.player_salary) /
        (league_available_pts_added +
          Math.max(player_row.pts_added[season_aggregate_key], 0))
    const projected_positive_salary_at_available_cap = Math.max(
      Math.round(
        league_adjusted_rate * player_row.pts_added[season_aggregate_key]
      ) || 0,
      0
    )
    player_row.projected_positive_salary_at_available_cap =
      projected_positive_salary_at_available_cap

    // The period sentinels are no longer written into the week column. The loop
    // below was period-blind by construction -- calculate_player_period_values
    // adds the rest-of-season keys and calculatePrices adds the season week key
    // to the same map the numeric weeks live in -- which is exactly what let the
    // sentinels accumulate. Each period now routes to its own table.
    //
    // Only the POSITIVE variant lands as a named column. The net siblings were
    // dropped 2026-08-18: calculate-prices.mjs floors this quantity at zero for
    // every aggregate key, net included, so a column named for the net variant
    // asserted a signed value it could never carry. Nothing read them.
    //
    // Narrowing each guard onto the surviving key drops a row that had a net
    // value and no positive one. That shape does not occur -- measured against
    // production before the drop: 1135 rows on each period table, 0 with net
    // non-null and positive null.
    //
    // The period keys are still read directly here rather than through the loop
    // below, which is left to the numeric weeks alone.
    const by_aggregate_key =
      player_row.projected_points_added_positive_including_cap_savings

    const season_positive = by_aggregate_key[season_aggregate_key]
    if (season_positive !== undefined) {
      season_value_inserts.push({
        pid: player_row.pid,
        season_year: current_season.year,
        lid,
        projected_points_added_positive_including_cap_savings: season_positive,
        projected_positive_salary_at_available_cap
      })
    }

    const rest_of_season_positive =
      by_aggregate_key[rest_of_season_aggregate_key]
    if (rest_of_season_positive !== undefined) {
      rest_of_season_value_inserts.push({
        pid: player_row.pid,
        season_year: current_season.year,
        lid,
        projected_points_added_positive_including_cap_savings:
          rest_of_season_positive
      })
    }

    for (const [
      week,
      projected_points_added_positive_including_cap_savings
    ] of Object.entries(by_aggregate_key)) {
      // `!Number(week)` drops the season week key (0) and every named aggregate
      // key (NaN) in one test, which is the same partition every period-bearing
      // writer here makes. It replaces an enumeration of the period keys, which
      // had to be extended by hand each time calculatePrices learned to price a
      // new aggregate -- and a missed one is not a stale row: this table is
      // written delete-by-lid THEN batch_insert, so an out-of-range week means
      // the delete commits, the insert throws on the 1..18 CHECK, and the table
      // is left EMPTY, blanking the available-cap salary on league-home, the
      // auction nomination panel and the selected-player panel for a full cron
      // cycle.
      if (!Number(week)) continue

      valueInserts.push({
        pid: player_row.pid,
        season_year: current_season.year,
        lid,
        week,
        projected_points_added_positive_including_cap_savings
      })
    }
  }

  // Baselines carry the same period overload the projection values did: week 0
  // means the season-long replacement level rather than a week. It splits the
  // same way, into league_season_baselines.
  //
  // The season table also FIXES A KEY DEFECT rather than mirroring one. The
  // week table's unique index is (lid, week, player_position, type) and omits
  // season_year, so one (lid, position, type) can hold only ONE row across all
  // years and each season silently overwrites the last; the season table keys
  // on (lid, season_year, player_position, type).
  const baselineInserts = []
  const season_baseline_inserts = []
  for (const [week, positions] of Object.entries(baselines)) {
    for (const [position, types] of Object.entries(positions)) {
      for (const [type, baseline] of Object.entries(types)) {
        if (!baseline) continue

        const row = {
          lid,
          season_year: current_season.year,
          player_position: position,
          // Null for the season 'starter' baseline, which is an expectation over
          // drawn seasons rather than a player. `points` carries it there.
          pid: baseline.pid,
          points: baseline.points,
          type
        }

        if (week === season_aggregate_key) {
          season_baseline_inserts.push(row)
        } else {
          baselineInserts.push({ ...row, week })
        }
      }
    }
  }

  if (baselineInserts.length) {
    await batch_insert({
      items: baselineInserts,
      save: (items) =>
        db('league_baselines')
          .insert(items)
          .onConflict(['lid', 'week', 'player_position', 'type'])
          .merge(),
      batch_size: 100
    })
    log(`saved ${baselineInserts.length} weekly baselines`)
  }

  if (season_baseline_inserts.length) {
    await batch_insert({
      items: season_baseline_inserts,
      save: (items) =>
        db('league_season_baselines')
          .insert(items)
          .onConflict(['lid', 'season_year', 'player_position', 'type'])
          .merge(),
      batch_size: 100
    })
    log(`saved ${season_baseline_inserts.length} season baselines`)
  }

  if (valueInserts.length) {
    await db('league_player_projection_values').del().where({ lid })
    await batch_insert({
      items: valueInserts,
      save: (items) =>
        db('league_player_projection_values')
          .insert(items)
          .onConflict(['pid', 'lid', 'week', 'season_year'])
          .merge(),
      batch_size: 100
    })
    log(`processed and saved ${valueInserts.length} player values`)
  }

  // Each period table is refreshed with the same delete-by-lid then reinsert
  // shape as the week table above, so a player dropping out of the projection
  // set does not leave a stale row behind.
  if (season_value_inserts.length) {
    await db('league_player_season_projection_values').del().where({ lid })
    await batch_insert({
      items: season_value_inserts,
      save: (items) =>
        db('league_player_season_projection_values')
          .insert(items)
          .onConflict(['pid', 'lid', 'season_year'])
          .merge(),
      batch_size: 100
    })
    log(`saved ${season_value_inserts.length} season player values`)
  }

  if (rest_of_season_value_inserts.length) {
    await db('league_player_rest_of_season_projection_values')
      .del()
      .where({ lid })
    await batch_insert({
      items: rest_of_season_value_inserts,
      save: (items) =>
        db('league_player_rest_of_season_projection_values')
          .insert(items)
          .onConflict(['pid', 'lid', 'season_year'])
          .merge(),
      batch_size: 100
    })
    log(
      `saved ${rest_of_season_value_inserts.length} rest of season player values`
    )
  }

  if (current_season.week <= current_season.final_week) {
    await project_lineups(lid)
    await calculateMatchupProjection({ lid })
    await calculatePlayoffMatchupProjection({ lid })
  }

  // Run season/playoff forecast simulation
  await run_season_forecast(lid)

  if (lid) {
    await db('leagues')
      .update({ processed_at: timestamp })
      .where({ league_id: lid })
  }
}

const run = async ({ year = current_season.year } = {}) => {
  const league_formats = {}
  const scoring_formats = {}
  const leagues_cache = {}

  const seas_type = current_season.nfl_seas_type === 'POST' ? 'POST' : 'REG'

  if (seas_type === 'POST') {
    await process_average_projections({ year, seas_type })
    return
  }

  // Read BEFORE the consensus upsert. Taken after it, the ratchet in
  // check_season_projections_consensus would compare this run's own output
  // against itself and could never report a shrink.
  const season_consensus_baseline = await read_season_consensus_baseline({
    season_year: year
  })

  const player_rows = await process_average_projections({ year })
  const projection_pids = player_rows.map((p) => p.pid)

  // Resolve the league set whose state must be processed end-to-end (rosters,
  // matchup projections, season forecast, leagues.processed_at). lid=0 is the
  // synthetic logged-out default league. The remainder is every currently
  // active, hosted league derived from the leagues table.
  const hosted_league_rows = await db('leagues')
    .select('league_id')
    .where({ is_hosted: true })
    .whereNull('archived_at')
  const lids = [0, ...hosted_league_rows.map((row) => row.league_id)]

  // league_formats values carry the pricing_model so process_league_format
  // can gate calculatePrices. Hosted leagues default to 'auction'; named
  // catalog entries supply their own pricing_model.
  for (const lid of lids) {
    const league = await getLeague({ lid, year })
    leagues_cache[lid] = league
    league_formats[league.league_format_id] = 'auction'
    scoring_formats[league.scoring_format_id] = true
  }

  // Additionally project under every named catalog scoring/league format so
  // the data-view analysis surface (e.g. DraftKings/FanDuel/PPR/etc.) has
  // current-year coverage. These named formats are not tied to any league;
  // they exist as analysis presets. pricing_model rides on each named entry.
  for (const named of Object.values(named_scoring_formats)) {
    scoring_formats[named.id] = true
  }
  for (const named of Object.values(named_league_formats)) {
    league_formats[named.id] = named.pricing_model || 'auction'
  }

  // Per-format try/catch: one broken format must not abort processing of the
  // remaining ~20+. Failures are collected and returned so the caller can
  // surface them as a single pipeline_failure signal with per-format detail.
  const per_format_failures = []

  for (const scoring_format_id of Object.keys(scoring_formats)) {
    const t0 = Date.now()
    try {
      await process_scoring_format_year({ year, scoring_format_id })
      log(`scoring_format=${scoring_format_id} duration_ms=${Date.now() - t0}`)
    } catch (err) {
      per_format_failures.push({
        stage: 'process_scoring_format',
        scoring_format_id,
        duration_ms: Date.now() - t0,
        message: err.message
      })
      log(
        `scoring_format=${scoring_format_id} FAILED duration_ms=${Date.now() - t0} error=${err.message}`
      )
    }
  }

  for (const [league_format_id, pricing_model] of Object.entries(
    league_formats
  )) {
    const t0 = Date.now()
    try {
      await process_league_format({
        year,
        league_format_id,
        projection_pids,
        pricing_model
      })
      log(
        `league_format=${league_format_id} pricing_model=${pricing_model} duration_ms=${Date.now() - t0}`
      )
    } catch (err) {
      per_format_failures.push({
        stage: 'process_league_format',
        league_format_id,
        pricing_model,
        duration_ms: Date.now() - t0,
        message: err.message
      })
      log(
        `league_format=${league_format_id} FAILED duration_ms=${Date.now() - t0} error=${err.message}`
      )
    }
  }

  for (const lid of lids) {
    const league = leagues_cache[lid]
    if (!league.is_hosted) {
      continue
    }

    try {
      await process_league({ year, lid })
    } catch (err) {
      per_format_failures.push({
        stage: 'process_league',
        lid,
        message: err.message
      })
      log(`process_league lid=${lid} FAILED error=${err.message}`)
    }
  }

  return { per_format_failures, season_consensus_baseline, year }
}

const check_oracle = async ({ seas_type, season_consensus_baseline, year }) => {
  // POST-season run() short-circuits after process_average_projections without
  // calling process_league(), so leagues.processed_at intentionally stays
  // stale. Skip the freshness oracle in that case.
  if (seas_type === 'POST') return null

  // Freshness oracle: every hosted, non-archived league must have been
  // processed within the last 2 hours (4 missed 30-min cron cycles).
  // leagues.processed_at is set to the script-start instant at the end of
  // process_league(), so a stale value means process_league() never completed
  // for that league — a silent partial-success the cron would otherwise miss.
  // The column is timestamptz as of the 2026-08-07 conformance pass, so the
  // bound is an instant; binding epoch seconds threw here and the throw was
  // swallowed, which left this oracle unable to report its own failure.
  const two_hours_ago = new Date(Date.now() - 7200 * 1000)
  const stale_leagues = await db('leagues')
    .select('league_id', 'processed_at')
    .where({ is_hosted: true })
    .whereNull('archived_at')
    .where(function () {
      this.whereNull('processed_at').orWhere('processed_at', '<', two_hours_ago)
    })

  if (stale_leagues.length > 0) {
    const details = stale_leagues
      .map((l) => `lid=${l.league_id} processed_at=${l.processed_at ?? 'null'}`)
      .join('; ')
    return `process-projections freshness oracle failed: ${details}`
  }

  const starter_identity_shortfall =
    await check_lineup_starter_identity_oracle()
  if (starter_identity_shortfall) return starter_identity_shortfall

  return check_season_projections_consensus({
    season_year: year ?? current_season.year,
    baseline: season_consensus_baseline
  })
}

// Output oracle for project_lineups. The freshness oracle above proves
// process_league() COMPLETED; it says nothing about what that run produced, and
// the difference is not academic. Between 2026-07-20 and 2026-08-02 the pid
// re-key left player_id_regex matching zero of 28,166 players, so optimizeLineup
// returned correct point totals with an empty starter list and this script wrote
// 85 starter rows an hour where it had written 1,513. It reported success 1,073
// times out of 1,073 while doing it, because nothing asserted on the output.
//
// The invariant: a team-week whose lineup carries points must have chosen at
// least one real player to earn them. `total` comes from the solver objective
// and the starter rows come from the filtered result keys, so any future break
// in the identity filter separates the two again and lands here. Teams that have
// never rostered two non-DST players are excluded -- an abandoned team can
// legitimately optimize to a lineup of nothing but a defense.
const check_lineup_starter_identity_oracle = async () => {
  const { rows } = await db.raw(
    `
    with rostered_teams as (
      select r.lid, r.tid
      from rosters r
      join rosters_players rp on rp.roster_id = r.roster_id
      join player p on p.pid = rp.pid
      where r.season_year = ? and p.primary_position <> 'DST'
      group by r.lid, r.tid
      having count(distinct rp.pid) >= 2
    ),
    player_starters as (
      select s.lid, s.tid, s.week
      from league_team_lineup_starters s
      join player p on p.pid = s.pid
      where s.season_year = ? and p.primary_position <> 'DST'
      group by s.lid, s.tid, s.week
    )
    select l.lid, l.tid, count(*)::int as weeks
    from league_team_lineups l
    join leagues lg on lg.league_id = l.lid
    join rostered_teams rt on rt.lid = l.lid and rt.tid = l.tid
    left join player_starters ps
      on ps.lid = l.lid and ps.tid = l.tid and ps.week = l.week
    where l.season_year = ?
      and lg.is_hosted = true
      and lg.archived_at is null
      and l.optimal_total > 0
      and ps.week is null
    group by l.lid, l.tid
    order by l.lid, l.tid
    `,
    [current_season.year, current_season.year, current_season.year]
  )

  if (!rows.length) return null

  const details = rows
    .map((r) => `lid=${r.lid} tid=${r.tid} weeks=${r.weeks}`)
    .join('; ')
  return `project-lineups starter-identity oracle failed: ${rows.length} team(s) have scoring lineups with no real-player starters: ${details}`
}

// The dedup keys MUST be `<kind>:<source>`. The pipeline_success recovery arm
// in the signals route resolves `pipeline_failure:${signal.source}` -- it
// derives the key from the source, not from the success signal's own key. A
// hand-shortened failure key (this file used
// `pipeline_failure:league:process-projections`) therefore never matches, so
// the recovery is structurally incapable of closing it and the signal stays
// open forever on a healthy pipeline. Signal 122353 sat open that way from
// 2026-07-23 while every run after it was clean.
// This pipeline is scheduled by the league host's OWN crontab
// (`server/crontab-main/league-imports.cron`, hourly at :30), not by base's
// schedule-processor -- the league host runs no schedule-processor, so a
// `scheduled-command` entity for it would be inert. The source therefore takes
// the host-cron shape `cron:<job>@<host>` (cf. `cron:check-host-resources@database`)
// rather than an entity uri. It previously named
// `user:scheduled-command/league/process-projections.md`, which has never
// existed, so every signal this pipeline raised addressed nothing.
const SIGNAL_SOURCE = 'cron:process-projections@league'
const SIGNAL_DEDUP_FAILURE = `pipeline_failure:${SIGNAL_SOURCE}`
const SIGNAL_DEDUP_SUCCESS = `pipeline_success:${SIGNAL_SOURCE}`

const main = async () => {
  enable_debug_namespaces(
    'process-projections,project-lineups,simulation:*,record-league-format-projection-value-history'
  )
  const seas_type = current_season.nfl_seas_type === 'POST' ? 'POST' : 'REG'
  let error
  let per_format_failures = []
  let shortfall = null
  let season_consensus_baseline = null
  let year

  try {
    const result = await run()
    per_format_failures = result?.per_format_failures || []
    season_consensus_baseline = result?.season_consensus_baseline || null
    year = result?.year
  } catch (err) {
    error = err
    console.log(error)
  }

  // Always run the oracle, even when run() threw. A throw means some formats
  // crashed; the oracle still tells us which hosted leagues didn't process.
  try {
    shortfall = await check_oracle({
      seas_type,
      season_consensus_baseline,
      year
    })
  } catch (err) {
    // An oracle that cannot RUN is a failed oracle, not a passed one. Swallowing
    // the throw left `shortfall` null, so report_job recorded success and the
    // exit code stayed 0 for as long as the oracle itself was broken — which is
    // exactly how its epoch-against-timestamptz bind went unnoticed.
    shortfall = `process-projections oracle could not run: ${err.message}`
    log(shortfall)
  }

  await report_job({
    job_type: job_types.PROCESS_PROJECTIONS,
    error: error || (shortfall ? new Error(shortfall) : null)
  })

  const has_failures =
    Boolean(error) || per_format_failures.length > 0 || Boolean(shortfall)

  if (has_failures) {
    const severity = error ? 'high' : 'medium'
    const title = error
      ? `process-projections threw: ${error.message}`
      : per_format_failures.length > 0
        ? `process-projections partial: ${per_format_failures.length} format(s) failed`
        : `process-projections oracle shortfall`
    await emit_signal({
      source: SIGNAL_SOURCE,
      kind: 'pipeline_failure',
      severity,
      title,
      payload: {
        error_message: error?.message,
        shortfall,
        per_format_failures
      },
      dedup_key: SIGNAL_DEDUP_FAILURE
    })
  } else {
    // Recovery: pipeline_success auto-resolves the matching open
    // pipeline_failure:<source> on insert. See user:text/base/signal-system.md.
    await emit_signal({
      source: SIGNAL_SOURCE,
      kind: 'pipeline_success',
      severity: 'low',
      title: 'process-projections succeeded',
      dedup_key: SIGNAL_DEDUP_SUCCESS
    })
  }

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default run
