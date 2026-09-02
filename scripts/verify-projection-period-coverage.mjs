#!/usr/bin/env node

// Verify that every league format anyone actually HOLDS PLAYERS IN has a season
// projection board, and that the live year has a rest-of-season one.
//
// The gap this catches is silent by construction. A missing (format, year) pair
// on `league_format_player_season_projection_values` produces no error anywhere:
// every reader is null-safe, so the holdings valuation writes NULL, the auction
// nomination order falls through to a lower tier, and the data-view columns
// render blank. 2025 `genesis_10_team` -- the live league's own format -- sat
// with ZERO season rows against 649 player holdings until 2026-09-02, and
// nothing in the codebase said so.
//
// SCOPE IS FORMATS IN USE, NOT THE NAMED CATALOG. Operator ruling 2026-09-02.
// The catalog framing looks more thorough and is worse: 114 of the 116 leagues
// carrying a format in 2023 are import shells with no roster rows, so their
// formats have no holdings to value, and asserting coverage for them would
// demand ~20 formats x 5 years of boards on a table that reached 8.5M rows once
// already. A format nobody holds players in has nothing to be wrong about.
//
// The pairs are derived from the DATABASE rather than from a list in this file,
// so a new league in a new format is covered the moment it has a roster and no
// registration step can be forgotten.
//
// REST OF SEASON IS CHECKED FOR THE LIVE YEAR ONLY. The quantity runs from the
// live week to the end of the year, so it does not exist for a completed season
// -- see build-league-format-period-inserts.mjs.

import debug from 'debug'

import db from '#db'
import { current_season } from '#constants'
import { is_main, emit_signal } from '#libs-server'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('verify-projection-period-coverage')
enable_debug_namespaces('verify-projection-period-coverage')

const SIGNAL_SOURCE = 'verify-projection-period-coverage'

const SEASON_TABLE = 'league_format_player_season_projection_values'
const REST_OF_SEASON_TABLE =
  'league_format_player_rest_of_season_projection_values'

// A (league_format_id, season_year) pair is IN USE when some league on that
// format in that year has at least one roster player row. Joining through
// rosters_players rather than stopping at `seasons` is the whole point: a
// format assignment with no holdings is an import shell.
export const find_formats_in_use = async () => {
  const rows = await db('seasons')
    .join('rosters', function () {
      this.on('rosters.lid', '=', 'seasons.lid').andOn(
        'rosters.season_year',
        '=',
        'seasons.season_year'
      )
    })
    .join('rosters_players', 'rosters_players.roster_id', 'rosters.roster_id')
    .whereNotNull('seasons.league_format_id')
    .select('seasons.league_format_id', 'seasons.season_year')
    .count('rosters_players.pid as roster_player_rows')
    .groupBy('seasons.league_format_id', 'seasons.season_year')
    .orderBy(['seasons.season_year', 'seasons.league_format_id'])

  return rows.map((row) => ({
    league_format_id: row.league_format_id,
    season_year: Number(row.season_year),
    roster_player_rows: Number(row.roster_player_rows)
  }))
}

// Coverage is counted on the VALUE columns, not on row presence. An adhoc
// migration can leave a full complement of rows whose every period column is
// NULL -- which is exactly the state 8,017 rows for 2020-2025 were in -- and a
// `count(*)` check reports that as covered.
const measure_pair = async ({ table, league_format_id, season_year }) => {
  const [row] = await db(table)
    .where({ league_format_id, season_year })
    .count('* as rows')
    .count('projected_points_added_positive as positive')
    .count('projected_points_added_net as net')
    .count('market_salary_positive as market_salary')

  return {
    rows: Number(row.rows),
    positive: Number(row.positive),
    net: Number(row.net),
    market_salary: Number(row.market_salary)
  }
}

const pricing_models_by_format_id = async (league_format_ids) => {
  if (!league_format_ids.length) return {}
  const rows = await db('league_formats')
    .whereIn('id', league_format_ids)
    .select('id', 'pricing_model')

  return Object.fromEntries(
    rows.map((row) => [row.id, row.pricing_model || 'auction'])
  )
}

export const verify_projection_period_coverage = async () => {
  const pairs = await find_formats_in_use()
  const pricing_models = await pricing_models_by_format_id([
    ...new Set(pairs.map((pair) => pair.league_format_id))
  ])

  const gaps = []

  for (const { league_format_id, season_year, roster_player_rows } of pairs) {
    const season = await measure_pair({
      table: SEASON_TABLE,
      league_format_id,
      season_year
    })

    const describe = `${league_format_id} ${season_year} (${roster_player_rows} roster player rows)`

    if (!season.positive) {
      gaps.push({
        table: SEASON_TABLE,
        league_format_id,
        season_year,
        detail: `${describe}: ${season.rows} rows, 0 with projected_points_added_positive`
      })
    }

    if (!season.net) {
      gaps.push({
        table: SEASON_TABLE,
        league_format_id,
        season_year,
        detail: `${describe}: ${season.rows} rows, 0 with projected_points_added_net`
      })
    }

    // Only an auction format prices. A dfs_fixed format publishes salaries
    // externally and calculate-prices.mjs declines it, so demanding a market
    // salary there would report a correct board as a gap forever.
    if (
      pricing_models[league_format_id] === 'auction' &&
      !season.market_salary
    ) {
      gaps.push({
        table: SEASON_TABLE,
        league_format_id,
        season_year,
        detail: `${describe}: pricing_model is auction, ${season.rows} rows, 0 with market_salary_positive`
      })
    }

    if (season_year !== current_season.year) continue

    const rest_of_season = await measure_pair({
      table: REST_OF_SEASON_TABLE,
      league_format_id,
      season_year
    })

    if (!rest_of_season.rows) {
      gaps.push({
        table: REST_OF_SEASON_TABLE,
        league_format_id,
        season_year,
        detail: `${describe}: 0 rows on the live year`
      })
    }
  }

  return { pairs, gaps }
}

const main = async () => {
  let error
  let result = { pairs: [], gaps: [] }

  try {
    result = await verify_projection_period_coverage()
  } catch (err) {
    error = err
    log(err)
  }

  // THE OUTPUT ORACLE IS DISTINCT FROM THE EXIT CODE, and this is the one that
  // matters here: a run that found no pairs at all would otherwise exit 0 and
  // read exactly like a clean board. Zero pairs means the derivation query
  // stopped working, not that nothing needs checking.
  const no_pairs = !error && !result.pairs.length

  for (const pair of result.pairs) {
    log(
      `${pair.league_format_id} ${pair.season_year}: ${pair.roster_player_rows} roster player rows`
    )
  }
  for (const gap of result.gaps) {
    log(`GAP ${gap.table}: ${gap.detail}`)
  }
  log(
    `${result.pairs.length} format-year pairs in use, ${result.gaps.length} gaps`
  )

  const failed = Boolean(error) || no_pairs || result.gaps.length > 0

  if (failed) {
    await emit_signal({
      source: SIGNAL_SOURCE,
      kind: 'pipeline_failure',
      severity: error || no_pairs ? 'high' : 'medium',
      title: error
        ? `verify-projection-period-coverage threw: ${error.message}`
        : no_pairs
          ? 'verify-projection-period-coverage found no format-year pairs in use'
          : `verify-projection-period-coverage found ${result.gaps.length} projection period gap(s)`,
      payload: {
        error_message: error?.message,
        pairs_in_use: result.pairs.length,
        gaps: result.gaps
      },
      dedup_key: `pipeline_failure:${SIGNAL_SOURCE}`
    })
  } else {
    await emit_signal({
      source: SIGNAL_SOURCE,
      kind: 'pipeline_success',
      severity: 'low',
      title: `verify-projection-period-coverage: ${result.pairs.length} format-year pairs covered`,
      dedup_key: `pipeline_success:${SIGNAL_SOURCE}`
    })
  }

  process.exit(failed ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default verify_projection_period_coverage
