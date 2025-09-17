import debug from 'debug'
import merge from 'deepmerge'
import fs from 'fs-extra'
import config from '#config'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { Table } from 'console-table-printer'

import db from '#db'
import { constants, groupBy } from '#libs-shared'
import { chunk_array } from '#libs-shared/chunk.mjs'
import { player_prop_types } from '#libs-shared/bookmaker-constants.mjs'
import { is_main } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('filter-prop-pairings')
debug.enable('filter-prop-pairings')

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../tmp')

const default_options = {
  market_odds_max_threshold: 1,
  current_season_soft_hit_rate_min_threshold: null,
  current_season_hard_hit_rate_min_threshold: null,
  current_season_opponent_allowed_rate_min_threshold: null,
  current_season_joint_historical_rate_min_threshold: null,
  prop_hits_min_threshold: 1,
  pairing_size_max_threshold: 3,
  highest_payout_min_threshold: 100,
  lowest_payout_min_threshold: 100,
  second_lowest_payout_min_threshold: 100,
  current_season_sum_hist_rate_soft_min_threshold: 0.7,
  current_season_sum_hist_rate_hard_min_threshold: 0.7,
  risk_total_max_threshold: 10,
  current_season_edge_min_threshold: 0,
  current_season_total_games_min_threshold: 3,
  exclude_players: [],
  include_players: [],
  include_teams: [],
  exclude_props: [],
  include_props: [],
  exclude_nfl_team: [],
  opponent_allowed_py_min: null,
  opponent_allowed_ry_min: null,
  opponent_allowed_recy_min: null,
  opponent_allowed_pc_min: null,
  opponent_allowed_tdp_min: null,
  opponent_allowed_rec_min: null,
  opponent_allowed_ints_min: null,
  opponent_allowed_ra_min: null,
  opponent_allowed_tdrec_min: null,
  opponent_allowed_tdr_min: null,
  opponent_allowed_pa_min: null,
  last_ten_hist_rate_soft_min_threshold: null,
  last_ten_hist_rate_hard_min_threshold: null,
  last_five_hist_rate_soft_min_threshold: null,
  last_five_hist_rate_hard_min_threshold: null,
  last_season_hist_rate_soft_min_threshold: null,
  last_season_hist_rate_hard_min_threshold: null
}

const opponent_allowed_for_prop_is_negative = ({
  opponent_seasonlog,
  market_type,
  opts = {}
}) => {
  switch (market_type) {
    case player_prop_types.GAME_PASSING_YARDS:
    case player_prop_types.GAME_ALT_PASSING_YARDS:
      return opponent_seasonlog.py < (opts.opponent_allowed_py_min || 0)

    case player_prop_types.GAME_RUSHING_YARDS:
    case player_prop_types.GAME_ALT_RUSHING_YARDS:
      return opponent_seasonlog.ry < (opts.opponent_allowed_ry_min || 0)

    case player_prop_types.GAME_RECEIVING_YARDS:
    case player_prop_types.GAME_ALT_RECEIVING_YARDS:
      return opponent_seasonlog.recy < (opts.opponent_allowed_recy_min || 0)

    case player_prop_types.GAME_ALT_PASSING_COMPLETIONS:
    case player_prop_types.GAME_PASSING_COMPLETIONS:
      return opponent_seasonlog.pc < (opts.opponent_allowed_pc_min || 0)

    case player_prop_types.GAME_PASSING_TOUCHDOWNS:
      return opponent_seasonlog.tdp < (opts.opponent_allowed_tdp_min || 0)

    case player_prop_types.GAME_RECEPTIONS:
      return opponent_seasonlog.rec < (opts.opponent_allowed_rec_min || 0)

    case player_prop_types.GAME_PASSING_INTERCEPTIONS:
      return opponent_seasonlog.ints < (opts.opponent_allowed_ints_min || 0)

    case player_prop_types.GAME_ALT_RUSHING_ATTEMPTS:
    case player_prop_types.GAME_RUSHING_ATTEMPTS:
      return opponent_seasonlog.ra < (opts.opponent_allowed_ra_min || 0)

    case player_prop_types.GAME_RUSHING_RECEIVING_YARDS:
      return opponent_seasonlog.ry + opponent_seasonlog.recy < 0

    case player_prop_types.GAME_RECEIVING_TOUCHDOWNS:
      return opponent_seasonlog.tdrec < (opts.opponent_allowed_tdrec_min || 0)

    case player_prop_types.GAME_RUSHING_TOUCHDOWNS:
      return opponent_seasonlog.tdr < (opts.opponent_allowed_tdr_min || 0)

    case player_prop_types.GAME_PASSING_ATTEMPTS:
      return opponent_seasonlog.pa < (opts.opponent_allowed_pa_min || 0)

    // player_prop_types.GAME_PASSING_LONGEST_COMPLETION,
    // player_prop_types.GAME_LONGEST_RECEPTION,
    case player_prop_types.ANYTIME_TOUCHDOWN:
      return opponent_seasonlog.tdr + opponent_seasonlog.tdrec < 1
    // player_prop_types.GAME_LONGEST_RUSH,
  }
}

const batch_size = 10000 // Adjust this value based on your database's capabilities

const fetch_prop_pairing_props = async (pairing_ids) => {
  const batches = chunk_array({ items: pairing_ids, chunk_size: batch_size })

  let all_prop_pairing_props = []

  for (const batch of batches) {
    const prop_pairing_props = await db('prop_pairing_props')
      .select(
        'weekly_market_selections_analysis_cache.*',
        'prop_pairing_props.pairing_id',
        'prop_market_selections_index.*'
      )
      .innerJoin('weekly_market_selections_analysis_cache', function () {
        this.on(
          'weekly_market_selections_analysis_cache.source_market_id',
          '=',
          'prop_pairing_props.source_market_id'
        ).andOn(
          'weekly_market_selections_analysis_cache.source_selection_id',
          '=',
          'prop_pairing_props.source_selection_id'
        )
      })
      .innerJoin('prop_market_selections_index', function () {
        this.on(
          'prop_market_selections_index.source_market_id',
          '=',
          'prop_pairing_props.source_market_id'
        )
          .andOn(
            'prop_market_selections_index.source_selection_id',
            '=',
            'prop_pairing_props.source_selection_id'
          )
          .andOn(
            'prop_market_selections_index.source_id',
            '=',
            'weekly_market_selections_analysis_cache.source_id'
          )
      })
      .where('prop_market_selections_index.time_type', 'CLOSE')
      .whereIn('pairing_id', batch)

    all_prop_pairing_props = all_prop_pairing_props.concat(prop_pairing_props)
  }

  return all_prop_pairing_props
}

const filter_prop_pairings = async ({
  week = constants.season.nfl_seas_week,
  year = constants.season.year,
  source = 'FANDUEL',
  filter_by_allowed_over_average = false
} = {}) => {
  const opts = merge(default_options, config.filter_prop_pairings_options || {})
  log('options:')
  log(opts)
  log({ week, year, source, filter_by_allowed_over_average })

  await db.raw('SET statement_timeout = 0')

  const prop_pairing_query = db('prop_pairings')
    .where('source_id', source)
    .where('week', week)
    .orderBy('current_season_hist_rate_hard', 'DESC')
    .orderBy('current_season_hist_rate_soft', 'DESC')
    .orderBy('current_season_hist_edge_soft', 'DESC')
    .orderBy('current_season_sum_hist_rate_soft', 'DESC')
    .orderBy('lowest_payout', 'DESC')

  if (
    opts.market_odds_max_threshold !== null &&
    opts.market_odds_max_threshold !== undefined
  ) {
    prop_pairing_query.where(
      'market_prob',
      '<=',
      opts.market_odds_max_threshold
    )
  }
  if (
    opts.current_season_soft_hit_rate_min_threshold !== null &&
    opts.current_season_soft_hit_rate_min_threshold !== undefined
  ) {
    prop_pairing_query.where(
      'current_season_hist_rate_soft',
      '>=',
      opts.current_season_soft_hit_rate_min_threshold
    )
  }
  if (
    opts.current_season_hard_hit_rate_min_threshold !== null &&
    opts.current_season_hard_hit_rate_min_threshold !== undefined
  ) {
    prop_pairing_query.where(
      'current_season_hist_rate_hard',
      '>=',
      opts.current_season_hard_hit_rate_min_threshold
    )
  }
  if (
    opts.current_season_opponent_allowed_rate_min_threshold !== null &&
    opts.current_season_opponent_allowed_rate_min_threshold !== undefined
  ) {
    prop_pairing_query.where(
      'current_season_opp_allow_rate',
      '>=',
      opts.current_season_opponent_allowed_rate_min_threshold
    )
  }
  if (
    opts.current_season_joint_historical_rate_min_threshold !== null &&
    opts.current_season_joint_historical_rate_min_threshold !== undefined
  ) {
    prop_pairing_query.where(
      'current_season_joint_hist_rate_soft',
      '>=',
      opts.current_season_joint_historical_rate_min_threshold
    )
  }
  if (
    opts.highest_payout_min_threshold !== null &&
    opts.highest_payout_min_threshold !== undefined
  ) {
    prop_pairing_query.where(
      'highest_payout',
      '>=',
      opts.highest_payout_min_threshold
    )
  }
  if (
    opts.lowest_payout_min_threshold !== null &&
    opts.lowest_payout_min_threshold !== undefined
  ) {
    prop_pairing_query.where(
      'lowest_payout',
      '>=',
      opts.lowest_payout_min_threshold
    )
  }
  if (
    opts.second_lowest_payout_min_threshold !== null &&
    opts.second_lowest_payout_min_threshold !== undefined
  ) {
    prop_pairing_query.where(
      'second_lowest_payout',
      '>=',
      opts.second_lowest_payout_min_threshold
    )
  }
  if (
    opts.current_season_edge_min_threshold !== null &&
    opts.current_season_edge_min_threshold !== undefined
  ) {
    prop_pairing_query.where(
      'current_season_hist_edge_soft',
      '>=',
      opts.current_season_edge_min_threshold
    )
  }
  if (
    opts.current_season_total_games_min_threshold !== null &&
    opts.current_season_total_games_min_threshold !== undefined
  ) {
    prop_pairing_query.where(
      'current_season_total_games',
      '>=',
      opts.current_season_total_games_min_threshold
    )
  }
  if (
    opts.risk_total_max_threshold !== null &&
    opts.risk_total_max_threshold !== undefined
  ) {
    prop_pairing_query.where('risk_total', '<=', opts.risk_total_max_threshold)
  }
  if (
    opts.pairing_size_max_threshold !== null &&
    opts.pairing_size_max_threshold !== undefined
  ) {
    prop_pairing_query.where('size', '<=', opts.pairing_size_max_threshold)
  }
  if (opts.exclude_nfl_team.length) {
    prop_pairing_query.whereNotIn('team', opts.exclude_nfl_team)
  }
  if (opts.include_teams.length) {
    prop_pairing_query.whereIn('team', opts.include_teams)
  }
  if (opts.current_season_sum_hist_rate_soft_min_threshold) {
    prop_pairing_query.where(
      'current_season_sum_hist_rate_soft',
      '>=',
      opts.current_season_sum_hist_rate_soft_min_threshold
    )
  }
  if (opts.current_season_sum_hist_rate_hard_min_threshold) {
    prop_pairing_query.where(
      'current_season_sum_hist_rate_hard',
      '>=',
      opts.current_season_sum_hist_rate_hard_min_threshold
    )
  }

  if (opts.last_ten_hist_rate_soft_min_threshold !== null) {
    prop_pairing_query.where(
      'last_ten_hist_rate_soft',
      '>=',
      opts.last_ten_hist_rate_soft_min_threshold
    )
  }
  if (opts.last_ten_hist_rate_hard_min_threshold !== null) {
    prop_pairing_query.where(
      'last_ten_hist_rate_hard',
      '>=',
      opts.last_ten_hist_rate_hard_min_threshold
    )
  }
  if (opts.last_five_hist_rate_soft_min_threshold !== null) {
    prop_pairing_query.where(
      'last_five_hist_rate_soft',
      '>=',
      opts.last_five_hist_rate_soft_min_threshold
    )
  }
  if (opts.last_five_hist_rate_hard_min_threshold !== null) {
    prop_pairing_query.where(
      'last_five_hist_rate_hard',
      '>=',
      opts.last_five_hist_rate_hard_min_threshold
    )
  }
  if (opts.last_season_hist_rate_soft_min_threshold !== null) {
    prop_pairing_query.where(
      'last_season_hist_rate_soft',
      '>=',
      opts.last_season_hist_rate_soft_min_threshold
    )
  }
  if (opts.last_season_hist_rate_hard_min_threshold !== null) {
    prop_pairing_query.where(
      'last_season_hist_rate_hard',
      '>=',
      opts.last_season_hist_rate_hard_min_threshold
    )
  }

  log(prop_pairing_query.toString())
  const prop_pairing_rows = await prop_pairing_query

  log(`loading ${prop_pairing_rows.length} prop pairings for week ${week}`)

  const pairing_ids = prop_pairing_rows.map((p) => p.pairing_id)
  const prop_pairing_props = await fetch_prop_pairing_props(pairing_ids)

  log(`loaded ${prop_pairing_props.length} props for week ${week}`)

  // Create a lookup object
  const prop_pairing_props_lookup = prop_pairing_props.reduce(
    (lookup, prop) => {
      if (!lookup[prop.pairing_id]) {
        lookup[prop.pairing_id] = []
      }
      lookup[prop.pairing_id].push(prop)
      return lookup
    },
    {}
  )

  for (const pairing of prop_pairing_rows) {
    pairing.props = prop_pairing_props_lookup[pairing.pairing_id] || []
  }

  log(`loaded ${prop_pairing_rows.length} prop pairings for week ${week}`)

  // load team seasonlogs
  const nfl_team_seasonlogs = await db('nfl_team_seasonlogs').where({
    year: constants.season.year
  })
  log(`loaded ${nfl_team_seasonlogs.length} team seasonlogs`)

  const unique_index = {}
  const team_index = {}

  const filtered = prop_pairing_rows.filter((prop) => {
    if (
      opts.exclude_players.length &&
      prop.props.some((p) => opts.exclude_players.includes(p.selection_pid))
    ) {
      return false
    }

    for (const team of opts.include_teams) {
      if (prop.team !== team) {
        return false
      }
    }

    for (const pid of opts.include_players) {
      if (!prop.props.some((p) => p.selection_pid === pid)) {
        return false
      }
    }

    for (const single_prop of prop.props) {
      if (single_prop.hits_soft < opts.prop_hits_min_threshold) {
        return false
      }

      if (opts.exclude_props.includes(single_prop.name)) {
        return false
      }

      if (filter_by_allowed_over_average) {
        const opponent_seasonlog = nfl_team_seasonlogs.find(
          (s) =>
            s.stat_key === `${single_prop.pos}_AGAINST_ADJ` &&
            s.tm === single_prop.opp
        )
        if (opponent_seasonlog) {
          const is_negative = opponent_allowed_for_prop_is_negative({
            opponent_seasonlog,
            market_type: single_prop.market_type,
            opts
          })
          if (is_negative) {
            return false
          }
        } else {
          log(`missing seasonlog for ${single_prop.opp}`)
        }
      }
    }

    if (opts.include_props.length) {
      const prop_names = prop.props.map((p) => p.name)
      if (!prop_names.some((name) => opts.include_props.includes(name))) {
        return false
      }
    }

    const prop_key = prop.props
      .map((p) => `${p.selection_pid}_${p.market_type}`)
      .join('_')
    if (unique_index[prop_key]) {
      unique_index[prop_key] += 1
      return false
    }

    // TODO unique by player / prop type

    if (team_index[prop.team]) {
      team_index[prop.team] += 1
      // TODO re-enable unique by team
      // return false
    }

    unique_index[prop_key] = 1
    team_index[prop.team] = 1

    return true
  })

  const summary = filtered.reduce(
    (accumulator, prop) => {
      if (prop.is_pending) {
        return {
          hits: accumulator.hits,
          current_season_hist_rate_soft:
            accumulator.current_season_hist_rate_soft,
          current_season_hist_rate_hard:
            accumulator.current_season_hist_rate_hard,
          market_prob: accumulator.market_prob,
          completed: accumulator.completed,
          pending: accumulator.pending + 1,
          payout: accumulator.payout + prop.payout_total,
          risk: accumulator.risk + prop.risk_total
        }
      } else {
        return {
          hits: prop.is_success ? accumulator.hits + 1 : accumulator.hits,
          current_season_hist_rate_soft:
            accumulator.current_season_hist_rate_soft +
            prop.current_season_hist_rate_soft,
          current_season_hist_rate_hard:
            accumulator.current_season_hist_rate_hard +
            prop.current_season_hist_rate_hard,
          market_prob: accumulator.market_prob + prop.market_prob,
          completed: accumulator.completed + 1,
          pending: accumulator.pending,
          payout: accumulator.payout + prop.payout_total,
          risk: accumulator.risk + prop.risk_total
        }
      }
    },
    {
      hits: 0,
      completed: 0,
      pending: 0,
      payout: 0,
      risk: 0,
      current_season_hist_rate_soft: 0,
      current_season_hist_rate_hard: 0,
      market_prob: 0
    }
  )
  const filtered_prop_sets_path = `${data_path}/prop_sets_filtered.json`
  await fs.writeJson(filtered_prop_sets_path, filtered, { spaces: 2 })

  log(`Plays: ${filtered.length}`)
  log(`Completed: ${summary.completed}`)
  log(`Hits: ${summary.hits}`)
  log(`Hit Rate: ${((summary.hits / summary.completed) * 100).toFixed(2)}%`)
  log(
    `Hits Over Market Expectation: ${(
      summary.hits - summary.market_prob
    ).toFixed(2)}`
  )
  log(
    `Hits Over Historical Expectation: ${(
      summary.hits - summary.current_season_hist_rate_soft
    ).toFixed(2)}`
  )
  log(
    `Payout (units): ${summary.payout.toFixed(
      1
    )}\tRisk (units): ${summary.risk.toFixed(1)}`
  )

  log('Plays')

  const grouped_by_team = groupBy(filtered, 'team')
  for (const team in grouped_by_team) {
    const p = new Table({
      title: `${team} plays`,
      columns: [
        { name: 'prop_1', alignment: 'left' },
        { name: 'prop_2', alignment: 'left' },
        { name: 'prop_3', alignment: 'left' },
        // { name: 'status', alignment: 'left' },
        { name: 'current_season_soft', alignment: 'right' },
        { name: 'current_season_hard', alignment: 'right' },
        { name: 'current_season_edge', alignment: 'right' },
        { name: 'last_5_soft', alignment: 'right' },
        { name: 'last_10_soft', alignment: 'right' },
        { name: 'high', alignment: 'right' },
        { name: 'low', alignment: 'right' },
        { name: 'current_season_sum', alignment: 'right' }
      ]
    })
    grouped_by_team[team].forEach((prop) => {
      const sorted_props = prop.props.sort(
        (a, b) => a.odds_american - b.odds_american
      )
      const prop_names = sorted_props.map(
        (p) =>
          `${p.name} [${Math.round(p.current_season_hit_rate_hard * 100)}% / ${p.odds_american}]`
      )

      p.addRow({
        prop_1: prop_names[0] || '',
        prop_2: prop_names[1] || '',
        prop_3: prop_names[2] || '',
        // status: 'pending',
        current_season_soft: `${Math.round(prop.current_season_hist_rate_soft * 100)}%`,
        current_season_hard: `${Math.round(prop.current_season_hist_rate_hard * 100)}%`,
        current_season_edge: `${(prop.current_season_hist_edge_soft * 100).toFixed(1)}%`,
        last_5_soft: `${Math.round(prop.last_five_hist_rate_soft * 100)}%`,
        last_10_soft: `${Math.round(prop.last_ten_hist_rate_soft * 100)}%`,
        high: prop.highest_payout,
        low: prop.lowest_payout,
        current_season_sum: `${Math.round(prop.current_season_sum_hist_rate_soft * 100)}%`
      })
    })

    p.printTable()
  }

  log('Plays By Team')
  const filtered_props_by_team = groupBy(filtered, 'team')
  for (const team of Object.keys(filtered_props_by_team)) {
    log(`${team}: ${filtered_props_by_team[team].length}`)
  }
}

const main = async () => {
  let error
  try {
    const week = argv.week
    const source = argv.source
    const filter_by_allowed_over_average = argv.filter_by_allowed_over_average
    await filter_prop_pairings({ week, source, filter_by_allowed_over_average })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default filter_prop_pairings
