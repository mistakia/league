import debug from 'debug'
import dayjs from 'dayjs'
import dayOfYear from 'dayjs/plugin/dayOfYear.js'

import db from '#db'
import {
  groupBy,
  Roster,
  getRosterSize,
  weightProjections,
  calculateValues,
  calculatePrices,
  calculateBaselines,
  calculatePlayerValuesRestOfSeason,
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
  getPlayers,
  getRoster,
  getLeague,
  get_player_transactions,
  is_main,
  batch_insert,
  report_job,
  simulation,
  emit_signal,
  record_league_format_projection_value_history
} from '#libs-server'
import project_lineups from './project-lineups.mjs'
import calculateMatchupProjection from './calculate-matchup-projection.mjs'
import calculatePlayoffMatchupProjection from './calculate-playoff-matchup-projection.mjs'
import { process_scoring_format_year } from './process-projections-for-scoring-format.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import first_projection_week_to_recompute from '#libs-shared/first-projection-week-to-recompute.mjs'

dayjs.extend(dayOfYear)

const log = debug('process-projections')
debug.enable(
  'process-projections,project-lineups,simulation:*,calculate-matchup-projection,record-league-format-projection-value-history'
)

const timestamp = Math.round(Date.now() / 1000)

/**
 * Run season forecast simulation and save results.
 * Uses the new player-level correlation simulation system.
 */
const run_season_forecast = async (lid) => {
  if (isNaN(lid)) {
    log('Skipping season forecast - invalid lid')
    return
  }

  const year = current_season.year
  let forecast_result

  try {
    // Get league to access wildcard_round and championship_round from seasons table
    const league = await getLeague({ lid, year })
    if (!league) {
      log(`League ${lid} not found, skipping forecast`)
      return
    }

    const wildcard_round = league.wildcard_round
    const championship_round = league.championship_round || []
    const championship_start_week =
      championship_round.length > 0 ? championship_round[0] : null

    if (current_season.week <= current_season.regularSeasonFinalWeek) {
      log(`Running season forecast for league ${lid}`)
      forecast_result = await simulation.simulate_season_forecast({
        league_id: lid,
        year
      })
    } else if (wildcard_round && current_season.week === wildcard_round) {
      log(
        `Running wildcard forecast for league ${lid} (week ${wildcard_round})`
      )
      forecast_result = await simulation.simulate_wildcard_forecast({
        league_id: lid,
        year
      })
    } else if (
      championship_start_week &&
      current_season.week >= championship_start_week &&
      current_season.week <= current_season.finalWeek
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
        year,
        day: dayjs().dayOfYear(),
        playoff_odds: forecast.playoff_odds,
        division_odds: forecast.division_odds,
        bye_odds: forecast.bye_odds,
        championship_odds: forecast.championship_odds,
        timestamp
      })
    }

    if (forecastInserts.length) {
      await db('league_team_forecast')
        .insert(forecastInserts)
        .onConflict(['tid', 'year', 'week', 'day'])
        .merge()
      log(`Saved ${forecastInserts.length} team forecasts`)
    }
  } catch (err) {
    log(`Error running season forecast: ${err.message}`)
    console.error(err)
  }
}

// The AVERAGE (sourceid 18) consensus is deliberately CURRENT-STATE ONLY. It is
// written to projections_index (and ros_projections) and NOT to
// projections_history. This is a decision, not an oversight: giving it a real
// generated_at at the hourly cadence this script runs at would append ~184M
// rows/year to projections_history, and the consensus is exactly derivable from
// the per-source history that already exists there.
//
// To reconstruct the consensus as of some instant D, take the latest observation
// of each real source at or before D and re-run weightProjections over it:
//
//   SELECT DISTINCT ON (sourceid, pid, week, season_year, season_type) *
//   FROM projections_history
//   WHERE generated_at <= D
//   ORDER BY sourceid, pid, week, season_year, season_type, generated_at DESC
//
// See user:text/league/projection-history-system.md for the full rationale.
const process_average_projections = async ({ year, seas_type = 'REG' }) => {
  log(`processing projections for year ${year} and seas_type ${seas_type}`)
  const projections = await get_player_projections({ year, seas_type })
  log(`fetched ${projections.length} projections`)
  const projections_by_pid = groupBy(projections, 'pid')
  const projection_pids = Object.keys(projections_by_pid)

  const player_rows = await db('player').whereIn('pid', projection_pids)

  const projectionInserts = []
  const rosProjectionInserts = []

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
      projectionInserts.push({
        pid: player_row.pid,
        sourceid: external_data_sources.AVERAGE,
        season_type: seas_type,
        season_year: current_season.year,
        week,
        ...projection
      })
      continue
    }

    // Regular season processing
    let week = first_projection_week_to_recompute({ year })
    for (; week <= current_season.nflFinalWeek; week++) {
      player_row.projection[week] = {}

      // average projection
      const projection = weightProjections({
        projections,
        week
      })

      player_row.projection[week] = projection
      projectionInserts.push({
        pid: player_row.pid,
        sourceid: external_data_sources.AVERAGE,
        season_type: seas_type,
        season_year: current_season.year,
        week,
        ...projection
      })
    }

    // Only calculate ROS projections for regular season
    if (seas_type === 'REG') {
      // calculate ros projection
      const ros = create_empty_projected_fantasy_stats()
      // A stat no source has an opinion on is null for every week, and summing
      // nulls into the zero-initialized accumulator would re-fabricate the
      // consensus weightProjections just stopped inventing. Track which stats
      // any week actually spoke to and null the rest back out.
      const ros_has_opinion = {}
      let proj_wks = 0
      for (const [week, projection] of Object.entries(player_row.projection)) {
        if (week && week !== '0' && week >= current_season.week) {
          proj_wks += 1
          for (const [key, value] of Object.entries(projection)) {
            if (value === null || value === undefined) continue
            ros[key] += value
            ros_has_opinion[key] = true
          }
        }
      }
      for (const key of Object.keys(ros)) {
        if (!ros_has_opinion[key]) ros[key] = null
      }

      player_row.proj_wks = proj_wks
      player_row.projection.ros = ros

      rosProjectionInserts.push({
        pid: player_row.pid,
        sourceid: external_data_sources.AVERAGE,
        season_year: current_season.year,
        ...ros
      })
    }
  }

  if (projectionInserts.length) {
    log(`processing ${projectionInserts.length} projections`)

    await batch_insert({
      items: projectionInserts,
      save: (items) =>
        db('projections_index')
          .insert(items)
          .onConflict([
            'sourceid',
            'pid',
            'userid',
            'week',
            'season_year',
            'season_type'
          ])
          .merge(),
      batch_size: 100
    })
    log(`processed and saved ${projectionInserts.length} projections`)
  }

  if (rosProjectionInserts.length) {
    log(`processing ${rosProjectionInserts.length} ros projections`)

    await batch_insert({
      items: rosProjectionInserts,
      save: (items) =>
        db('ros_projections')
          .insert(items)
          .onConflict(['sourceid', 'pid', 'season_year'])
          .merge(),
      batch_size: 100
    })
    log(`processed and saved ${rosProjectionInserts.length} ros projections`)
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

  const { num_teams, cap, min_bid } = league_format
  const league_roster_size = getRosterSize(league_format)
  const league_total_salary_cap =
    num_teams * cap - num_teams * league_roster_size * min_bid

  const player_rows = await getPlayers({
    pids: projection_pids,
    league_format_id: league_format.league_format_id,
    scoring_format_id: league_format.scoring_format_id
  })

  const baselines = {}
  let week = first_projection_week_to_recompute({ year })
  for (; week <= current_season.nflFinalWeek; week++) {
    const baseline = calculateBaselines({
      players: player_rows,
      league: league_format,
      week
    })
    baselines[week] = baseline

    const total_pts_added = calculateValues({
      players: player_rows,
      baselines: baseline,
      week
    })

    // Auction-pricing only. DFS contests (pricing_model='dfs_fixed') publish
    // per-player salaries externally (player_salaries table); deriving a
    // market_salary from a contest-entry cap and num_teams=1 is meaningless
    // and overflows the column. pts_added stays meaningful for any format.
    if (pricing_model === 'auction') {
      calculatePrices({
        cap: league_total_salary_cap,
        surplus_cap_share: league_format.surplus_cap_share,
        total_pts_added,
        players: player_rows,
        week
      })
    }
  }

  calculatePlayerValuesRestOfSeason({
    players: player_rows,
    league: league_format,
    pricing_model
  })

  const valueInserts = []
  for (const player_row of player_rows) {
    for (const [week, pts_added] of Object.entries(player_row.pts_added)) {
      const params = {
        pid: player_row.pid,
        year: current_season.year,
        league_format_id,
        week,
        pts_added,
        market_salary:
          pricing_model === 'auction' ? player_row.market_salary[week] : null
      }

      valueInserts.push(params)
    }
  }

  if (valueInserts.length) {
    // Record the dated observation BEFORE the destructive rewrite below. The
    // current-state table is delete-then-reinsert, so history has to be captured
    // from the computed values rather than read back afterwards.
    await record_league_format_projection_value_history({
      league_format_id,
      year: current_season.year,
      value_rows: valueInserts
    })

    // Scoped to the year being rewritten. This delete was previously unscoped and
    // wiped every prior season's values for the format on each hourly run, while
    // the reinsert below only ever restores current_season.year.
    await db('league_format_player_projection_values')
      .del()
      .where({ league_format_id, year: current_season.year })
    await batch_insert({
      items: valueInserts,
      save: (items) =>
        db('league_format_player_projection_values').insert(items),
      batch_size: 100
    })
    log(`processed and saved ${valueInserts.length} player values`)
  }
}

const process_league = async ({ year, lid }) => {
  let week = first_projection_week_to_recompute({ year })

  const league = await getLeague({ lid })
  const teams = await db('teams').where({ lid, year })
  const league_roster_size = getRosterSize(league)

  const { num_teams, cap, min_bid } = league
  const league_total_salary_cap =
    num_teams * cap - num_teams * league_roster_size * min_bid
  let league_available_salary_space = 0

  // initialize roster rows
  const rosterRows = []
  const rostered_pids = []

  // check to see if it is past the fantasy season
  if (week <= current_season.finalWeek) {
    for (const team of teams) {
      const rosterRow = await getRoster({ tid: team.uid, week })
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
    player_row.value = tran.value
  }

  week = first_projection_week_to_recompute({ year })

  const baselines = {}
  for (; week <= current_season.nflFinalWeek; week++) {
    // baselines
    const baseline = calculateBaselines({
      players: player_rows,
      league,
      rosterRows,
      week
    })
    baselines[week] = baseline

    // calculate values
    const total_pts_added = calculateValues({
      players: player_rows,
      baselines: baseline,
      week
    })
    calculatePrices({
      cap: league_total_salary_cap,
      surplus_cap_share: league.surplus_cap_share,
      total_pts_added,
      players: player_rows,
      week
    })
  }

  calculatePlayerValuesRestOfSeason({
    players: player_rows,
    rosterRows,
    league
  })

  let league_available_pts_added = 0
  for (const player_row of player_rows) {
    const is_available = !rostered_pids.includes(player_row.pid)
    if (is_available && player_row.pts_added[0] > 0) {
      league_available_pts_added =
        league_available_pts_added + player_row.pts_added[0]
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
      : (league_available_salary_space + player_row.value) /
        (league_available_pts_added + Math.max(player_row.pts_added[0], 0))
    const market_salary_adj = Math.max(
      Math.round(league_adjusted_rate * player_row.pts_added[0]) || 0,
      0
    )
    player_row.market_salary_adj = market_salary_adj

    // The period sentinels are no longer written into the week column. This loop
    // was period-blind by construction -- calculatePlayerValuesRestOfSeason adds
    // a 'ros' key and calculatePrices adds a '0' key to the same map the numeric
    // weeks live in -- which is exactly what let the sentinels accumulate. Each
    // period now routes to its own table.
    for (const [week, salary_adj_pts_added] of Object.entries(
      player_row.salary_adj_pts_added
    )) {
      if (week === '0') {
        season_value_inserts.push({
          pid: player_row.pid,
          season_year: current_season.year,
          lid,
          salary_adj_pts_added,
          market_salary_adj
        })
        continue
      }

      if (week === 'ros') {
        rest_of_season_value_inserts.push({
          pid: player_row.pid,
          season_year: current_season.year,
          lid,
          salary_adj_pts_added
        })
        continue
      }

      valueInserts.push({
        pid: player_row.pid,
        year: current_season.year,
        lid,
        week,
        salary_adj_pts_added
      })
    }
  }

  const baselineInserts = []
  for (const [week, positions] of Object.entries(baselines)) {
    for (const [position, types] of Object.entries(positions)) {
      for (const [type, baseline] of Object.entries(types)) {
        if (!baseline) continue

        baselineInserts.push({
          lid,
          week,
          year: current_season.year,
          pos: position,
          pid: baseline.pid,
          type
        })
      }
    }
  }

  if (baselineInserts.length) {
    await batch_insert({
      items: baselineInserts,
      save: (items) =>
        db('league_baselines')
          .insert(items)
          .onConflict(['lid', 'week', 'pos', 'type'])
          .merge(),
      batch_size: 100
    })
    log(`saved ${baselineInserts.length} baselines`)
  }

  if (valueInserts.length) {
    await db('league_player_projection_values').del().where({ lid })
    await batch_insert({
      items: valueInserts,
      save: (items) =>
        db('league_player_projection_values')
          .insert(items)
          .onConflict(['pid', 'lid', 'week', 'year'])
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

  if (current_season.week <= current_season.finalWeek) {
    await project_lineups(lid)
    await calculateMatchupProjection({ lid })
    await calculatePlayoffMatchupProjection({ lid })
  }

  // Run season/playoff forecast simulation
  await run_season_forecast(lid)

  if (lid) {
    await db('leagues').update({ processed_at: timestamp }).where({ uid: lid })
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

  const player_rows = await process_average_projections({ year })
  const projection_pids = player_rows.map((p) => p.pid)

  // Resolve the league set whose state must be processed end-to-end (rosters,
  // matchup projections, season forecast, leagues.processed_at). lid=0 is the
  // synthetic logged-out default league. The remainder is every currently
  // active, hosted league derived from the leagues table.
  const hosted_league_rows = await db('leagues')
    .select('uid')
    .where({ hosted: true })
    .whereNull('archived_at')
  const lids = [0, ...hosted_league_rows.map((row) => row.uid)]

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
    if (!league.hosted) {
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

  return { per_format_failures }
}

const check_oracle = async ({ seas_type }) => {
  // POST-season run() short-circuits after process_average_projections without
  // calling process_league(), so leagues.processed_at intentionally stays
  // stale. Skip the freshness oracle in that case.
  if (seas_type === 'POST') return null

  // Freshness oracle: every hosted, non-archived league must have been
  // processed within the last 2 hours (4 missed 30-min cron cycles).
  // leagues.processed_at is set to the script-start epoch at the end of
  // process_league(), so a stale value means process_league() never completed
  // for that league — a silent partial-success the cron would otherwise miss.
  const two_hours_ago = Math.round(Date.now() / 1000) - 7200
  const stale_leagues = await db('leagues')
    .select('uid', 'processed_at')
    .where({ hosted: true })
    .whereNull('archived_at')
    .where(function () {
      this.whereNull('processed_at').orWhere('processed_at', '<', two_hours_ago)
    })

  if (stale_leagues.length > 0) {
    const details = stale_leagues
      .map((l) => `lid=${l.uid} processed_at=${l.processed_at ?? 'null'}`)
      .join('; ')
    return `process-projections freshness oracle failed: ${details}`
  }

  return check_lineup_starter_identity_oracle()
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
      join rosters_players rp on rp.rid = r.uid
      join player p on p.pid = rp.pid
      where r.year = ? and p.primary_position <> 'DST'
      group by r.lid, r.tid
      having count(distinct rp.pid) >= 2
    ),
    player_starters as (
      select s.lid, s.tid, s.week
      from league_team_lineup_starters s
      join player p on p.pid = s.pid
      where s.year = ? and p.primary_position <> 'DST'
      group by s.lid, s.tid, s.week
    )
    select l.lid, l.tid, count(*)::int as weeks
    from league_team_lineups l
    join leagues lg on lg.uid = l.lid
    join rostered_teams rt on rt.lid = l.lid and rt.tid = l.tid
    left join player_starters ps
      on ps.lid = l.lid and ps.tid = l.tid and ps.week = l.week
    where l.year = ?
      and lg.hosted = true
      and lg.archived_at is null
      and l.total > 0
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
const SIGNAL_SOURCE = 'user:scheduled-command/league/process-projections.md'
const SIGNAL_DEDUP_FAILURE = `pipeline_failure:${SIGNAL_SOURCE}`
const SIGNAL_DEDUP_SUCCESS = `pipeline_success:${SIGNAL_SOURCE}`

const main = async () => {
  debug.enable(
    'process-projections,project-lineups,simulation:*,record-league-format-projection-value-history'
  )
  const seas_type = current_season.nfl_seas_type === 'POST' ? 'POST' : 'REG'
  let error
  let per_format_failures = []
  let shortfall = null

  try {
    const result = await run()
    per_format_failures = result?.per_format_failures || []
  } catch (err) {
    error = err
    console.log(error)
  }

  // Always run the oracle, even when run() threw. A throw means some formats
  // crashed; the oracle still tells us which hosted leagues didn't process.
  try {
    shortfall = await check_oracle({ seas_type })
  } catch (err) {
    log(`check_oracle threw: ${err.message}`)
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

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
