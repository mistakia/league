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

// Configuration constants
const DEBUG_NAMESPACE = 'filter-prop-pairings'
const BATCH_SIZE = 10000
const PAIRING_BATCH_SIZE = 5000
const DEFAULT_TIMEOUT = 0

// Initialize debug and paths
const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug(DEBUG_NAMESPACE)
debug.enable(DEBUG_NAMESPACE)

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../tmp')

/**
 * Default filter options for prop pairings
 * @type {Object}
 */
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

/**
 * Maps prop types to their corresponding opponent allowed stat keys and minimum thresholds
 */
const PROP_OPPONENT_ALLOWED_MAPPING = {
  [player_prop_types.GAME_PASSING_YARDS]: {
    stat_key: 'py',
    threshold_key: 'opponent_allowed_py_min'
  },
  [player_prop_types.GAME_ALT_PASSING_YARDS]: {
    stat_key: 'py',
    threshold_key: 'opponent_allowed_py_min'
  },
  [player_prop_types.GAME_RUSHING_YARDS]: {
    stat_key: 'ry',
    threshold_key: 'opponent_allowed_ry_min'
  },
  [player_prop_types.GAME_ALT_RUSHING_YARDS]: {
    stat_key: 'ry',
    threshold_key: 'opponent_allowed_ry_min'
  },
  [player_prop_types.GAME_RECEIVING_YARDS]: {
    stat_key: 'recy',
    threshold_key: 'opponent_allowed_recy_min'
  },
  [player_prop_types.GAME_ALT_RECEIVING_YARDS]: {
    stat_key: 'recy',
    threshold_key: 'opponent_allowed_recy_min'
  },
  [player_prop_types.GAME_ALT_PASSING_COMPLETIONS]: {
    stat_key: 'pc',
    threshold_key: 'opponent_allowed_pc_min'
  },
  [player_prop_types.GAME_PASSING_COMPLETIONS]: {
    stat_key: 'pc',
    threshold_key: 'opponent_allowed_pc_min'
  },
  [player_prop_types.GAME_PASSING_TOUCHDOWNS]: {
    stat_key: 'tdp',
    threshold_key: 'opponent_allowed_tdp_min'
  },
  [player_prop_types.GAME_RECEPTIONS]: {
    stat_key: 'rec',
    threshold_key: 'opponent_allowed_rec_min'
  },
  [player_prop_types.GAME_PASSING_INTERCEPTIONS]: {
    stat_key: 'ints',
    threshold_key: 'opponent_allowed_ints_min'
  },
  [player_prop_types.GAME_ALT_RUSHING_ATTEMPTS]: {
    stat_key: 'ra',
    threshold_key: 'opponent_allowed_ra_min'
  },
  [player_prop_types.GAME_RUSHING_ATTEMPTS]: {
    stat_key: 'ra',
    threshold_key: 'opponent_allowed_ra_min'
  },
  [player_prop_types.GAME_RECEIVING_TOUCHDOWNS]: {
    stat_key: 'tdrec',
    threshold_key: 'opponent_allowed_tdrec_min'
  },
  [player_prop_types.GAME_RUSHING_TOUCHDOWNS]: {
    stat_key: 'tdr',
    threshold_key: 'opponent_allowed_tdr_min'
  },
  [player_prop_types.GAME_PASSING_ATTEMPTS]: {
    stat_key: 'pa',
    threshold_key: 'opponent_allowed_pa_min'
  },
  [player_prop_types.ANYTIME_TOUCHDOWN]: {
    stat_key: 'tdr_tdrec',
    threshold_key: null
  }
}

/**
 * Checks if opponent allowed stats are below threshold for a specific prop type
 * @param {Object} params - Parameters object
 * @param {Object} params.opponent_seasonlog - Season log data for the opponent
 * @param {string} params.market_type - The market type to check
 * @param {Object} params.opts - Options containing threshold values
 * @returns {boolean} True if opponent allowed stats are below threshold
 */
const is_opponent_allowed_below_threshold = ({
  opponent_seasonlog,
  market_type,
  opts = {}
}) => {
  const mapping = PROP_OPPONENT_ALLOWED_MAPPING[market_type]

  if (!mapping) {
    return false
  }

  // Special case for anytime touchdown (combines rushing and receiving TDs)
  if (market_type === player_prop_types.ANYTIME_TOUCHDOWN) {
    return opponent_seasonlog.tdr + opponent_seasonlog.tdrec < 1
  }

  // Special case for rushing + receiving yards
  if (market_type === player_prop_types.GAME_RUSHING_RECEIVING_YARDS) {
    return opponent_seasonlog.ry + opponent_seasonlog.recy < 0
  }

  const stat_value = opponent_seasonlog[mapping.stat_key]
  const threshold_value = opts[mapping.threshold_key] || 0

  return stat_value < threshold_value
}

/**
 * Checks if a prop should be excluded based on player filters
 * @param {Object} prop - The prop pairing object
 * @param {Object} opts - Filter options
 * @returns {boolean} True if prop should be excluded
 */
const should_exclude_by_player_filters = (prop, opts) => {
  // Check exclude players
  if (
    opts.exclude_players.length &&
    prop.props.some((p) => opts.exclude_players.includes(p.selection_pid))
  ) {
    return true
  }

  // Check include teams
  if (opts.include_teams.length && !opts.include_teams.includes(prop.team)) {
    return true
  }

  // Check include players
  if (
    opts.include_players.length &&
    !opts.include_players.every((pid) =>
      prop.props.some((p) => p.selection_pid === pid)
    )
  ) {
    return true
  }

  return false
}

/**
 * Checks if individual props meet the minimum requirements
 * @param {Object} prop - The prop pairing object
 * @param {Object} opts - Filter options
 * @returns {boolean} True if all props meet requirements
 */
const validate_individual_props = (prop, opts) => {
  for (const single_prop of prop.props) {
    if (single_prop.hits_soft < opts.prop_hits_min_threshold) {
      return false
    }

    if (opts.exclude_props.includes(single_prop.name)) {
      return false
    }
  }

  // Check include props
  if (opts.include_props.length) {
    const prop_names = prop.props.map((p) => p.name)
    if (!prop_names.some((name) => opts.include_props.includes(name))) {
      return false
    }
  }

  return true
}

/**
 * Checks if opponent allowed stats are below threshold for all props
 * @param {Object} prop - The prop pairing object
 * @param {Array} nfl_team_seasonlogs - Team season logs
 * @param {Object} opts - Filter options
 * @returns {boolean} True if any prop fails opponent allowed check
 */
const check_opponent_allowed_stats = (prop, nfl_team_seasonlogs, opts) => {
  for (const single_prop of prop.props) {
    const opponent_seasonlog = nfl_team_seasonlogs.find(
      (s) =>
        s.stat_key === `${single_prop.pos}_AGAINST_ADJ` &&
        s.tm === single_prop.opp
    )

    if (opponent_seasonlog) {
      const is_below_threshold = is_opponent_allowed_below_threshold({
        opponent_seasonlog,
        market_type: single_prop.market_type,
        opts
      })
      if (is_below_threshold) {
        return true // Should exclude this prop
      }
    } else {
      log(`missing seasonlog for ${single_prop.opp}`)
    }
  }
  return false
}

/**
 * Checks for duplicate prop combinations and team limits
 * @param {Object} prop - The prop pairing object
 * @param {Object} unique_index - Index to track unique prop combinations
 * @param {Object} team_index - Index to track team occurrences
 * @returns {boolean} True if prop is a duplicate
 */
const is_duplicate_prop = (prop, unique_index, team_index) => {
  const prop_key = prop.props
    .map((p) => `${p.selection_pid}_${p.market_type}`)
    .join('_')

  if (unique_index[prop_key]) {
    unique_index[prop_key] += 1
    return true
  }

  if (team_index[prop.team]) {
    team_index[prop.team] += 1
    // TODO: re-enable unique by team
    // return true
  }

  unique_index[prop_key] = 1
  team_index[prop.team] = 1
  return false
}

/**
 * Filters a batch of prop pairings based on various criteria
 * @param {Array} pairings - Array of prop pairings to filter
 * @param {Array} nfl_team_seasonlogs - Team season logs for opponent checks
 * @param {Object} opts - Filter options
 * @param {boolean} filter_by_allowed_over_average - Whether to filter by opponent allowed stats
 * @param {Object} unique_index - Index to track unique combinations
 * @param {Object} team_index - Index to track team occurrences
 * @returns {Array} Filtered array of prop pairings
 */
const filter_batch = (
  pairings,
  nfl_team_seasonlogs,
  opts,
  filter_by_allowed_over_average,
  unique_index,
  team_index
) => {
  return pairings.filter((prop) => {
    // Check player-based exclusions
    if (should_exclude_by_player_filters(prop, opts)) {
      return false
    }

    // Check individual prop requirements
    if (!validate_individual_props(prop, opts)) {
      return false
    }

    // Check opponent allowed stats if enabled
    if (
      filter_by_allowed_over_average &&
      check_opponent_allowed_stats(prop, nfl_team_seasonlogs, opts)
    ) {
      return false
    }

    // Check for duplicates
    if (is_duplicate_prop(prop, unique_index, team_index)) {
      return false
    }

    return true
  })
}

/**
 * Fetches prop pairing properties for given pairing IDs in batches
 * @param {Array} pairing_ids - Array of pairing IDs to fetch
 * @returns {Promise<Array>} Array of prop pairing properties
 */
const fetch_prop_pairing_props = async (pairing_ids) => {
  const batches = chunk_array({ items: pairing_ids, chunk_size: BATCH_SIZE })
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

/**
 * Applies threshold filters to the query
 * @param {Object} query - Knex query builder
 * @param {Object} opts - Filter options
 */
const apply_threshold_filters = (query, opts) => {
  const threshold_filters = [
    {
      field: 'market_prob',
      threshold: opts.market_odds_max_threshold,
      operator: '<='
    },
    {
      field: 'current_season_hist_rate_soft',
      threshold: opts.current_season_soft_hit_rate_min_threshold,
      operator: '>='
    },
    {
      field: 'current_season_hist_rate_hard',
      threshold: opts.current_season_hard_hit_rate_min_threshold,
      operator: '>='
    },
    {
      field: 'current_season_opp_allow_rate',
      threshold: opts.current_season_opponent_allowed_rate_min_threshold,
      operator: '>='
    },
    {
      field: 'current_season_joint_hist_rate_soft',
      threshold: opts.current_season_joint_historical_rate_min_threshold,
      operator: '>='
    },
    {
      field: 'highest_payout',
      threshold: opts.highest_payout_min_threshold,
      operator: '>='
    },
    {
      field: 'lowest_payout',
      threshold: opts.lowest_payout_min_threshold,
      operator: '>='
    },
    {
      field: 'second_lowest_payout',
      threshold: opts.second_lowest_payout_min_threshold,
      operator: '>='
    },
    {
      field: 'current_season_hist_edge_soft',
      threshold: opts.current_season_edge_min_threshold,
      operator: '>='
    },
    {
      field: 'current_season_total_games',
      threshold: opts.current_season_total_games_min_threshold,
      operator: '>='
    },
    {
      field: 'risk_total',
      threshold: opts.risk_total_max_threshold,
      operator: '<='
    },
    {
      field: 'size',
      threshold: opts.pairing_size_max_threshold,
      operator: '<='
    },
    {
      field: 'current_season_sum_hist_rate_soft',
      threshold: opts.current_season_sum_hist_rate_soft_min_threshold,
      operator: '>='
    },
    {
      field: 'current_season_sum_hist_rate_hard',
      threshold: opts.current_season_sum_hist_rate_hard_min_threshold,
      operator: '>='
    },
    {
      field: 'last_ten_hist_rate_soft',
      threshold: opts.last_ten_hist_rate_soft_min_threshold,
      operator: '>='
    },
    {
      field: 'last_ten_hist_rate_hard',
      threshold: opts.last_ten_hist_rate_hard_min_threshold,
      operator: '>='
    },
    {
      field: 'last_five_hist_rate_soft',
      threshold: opts.last_five_hist_rate_soft_min_threshold,
      operator: '>='
    },
    {
      field: 'last_five_hist_rate_hard',
      threshold: opts.last_five_hist_rate_hard_min_threshold,
      operator: '>='
    },
    {
      field: 'last_season_hist_rate_soft',
      threshold: opts.last_season_hist_rate_soft_min_threshold,
      operator: '>='
    },
    {
      field: 'last_season_hist_rate_hard',
      threshold: opts.last_season_hist_rate_hard_min_threshold,
      operator: '>='
    }
  ]

  threshold_filters.forEach(({ field, threshold, operator }) => {
    if (threshold !== null && threshold !== undefined) {
      query.where(field, operator, threshold)
    }
  })
}

/**
 * Applies team and player filters to the query
 * @param {Object} query - Knex query builder
 * @param {Object} opts - Filter options
 */
const apply_team_player_filters = (query, opts) => {
  if (opts.exclude_nfl_team.length) {
    query.whereNotIn('team', opts.exclude_nfl_team)
  }

  if (opts.include_teams.length) {
    query.whereIn('team', opts.include_teams)
  }
}

/**
 * Builds the base prop pairing query with all filters applied
 * @param {Object} opts - Filter options
 * @param {number} week - Week number
 * @param {string} source - Data source
 * @returns {Object} Knex query builder
 */
const build_prop_pairing_query = (opts, week, source) => {
  const query = db('prop_pairings')
    .where('source_id', source)
    .where('week', week)
    .orderBy('current_season_hist_rate_hard', 'DESC')
    .orderBy('current_season_hist_rate_soft', 'DESC')
    .orderBy('current_season_hist_edge_soft', 'DESC')
    .orderBy('current_season_sum_hist_rate_soft', 'DESC')
    .orderBy('lowest_payout', 'DESC')

  apply_threshold_filters(query, opts)
  apply_team_player_filters(query, opts)

  return query
}

/**
 * Main function to filter prop pairings based on various criteria
 * @param {Object} params - Parameters object
 * @param {number} params.week - Week number (defaults to current NFL season week)
 * @param {number} params.year - Year (defaults to current season year)
 * @param {string} params.source - Data source (defaults to 'FANDUEL')
 * @param {boolean} params.filter_by_allowed_over_average - Whether to filter by opponent allowed stats
 * @returns {Promise<void>}
 */
const filter_prop_pairings = async ({
  week = constants.season.nfl_seas_week,
  year = constants.season.year,
  source = 'FANDUEL',
  filter_by_allowed_over_average = false
} = {}) => {
  const opts = merge(default_options, config.filter_prop_pairings_options || {})
  log('options:', opts)
  log({ week, year, source, filter_by_allowed_over_average })

  await db.raw(`SET statement_timeout = ${DEFAULT_TIMEOUT}`)

  const prop_pairing_query = build_prop_pairing_query(opts, week, source)
  log('Query:', prop_pairing_query.toString())

  // Load team seasonlogs once before batch processing
  const nfl_team_seasonlogs = await db('nfl_team_seasonlogs').where({
    year: constants.season.year
  })
  log(`loaded ${nfl_team_seasonlogs.length} team seasonlogs`)

  // Initialize tracking objects that persist across batches
  const unique_index = {}
  const team_index = {}
  const filtered = []

  // Batch processing loop
  let current_offset = 0
  let current_batch_number = 1
  let total_loaded_count = 0

  while (true) {
    log(`Processing batch ${current_batch_number} (offset: ${current_offset})`)

    // Load batch of pairings
    const current_batch_pairings = await prop_pairing_query
      .clone() // Important: clone query for reuse
      .limit(PAIRING_BATCH_SIZE)
      .offset(current_offset)

    if (current_batch_pairings.length === 0) {
      log('No more pairings to process')
      break
    }

    total_loaded_count += current_batch_pairings.length
    log(
      `Batch ${current_batch_number}: loaded ${current_batch_pairings.length} pairings (total: ${total_loaded_count})`
    )

    // Load props for this batch only
    const current_batch_pairing_ids = current_batch_pairings.map(
      (p) => p.pairing_id
    )
    const current_batch_props = await fetch_prop_pairing_props(
      current_batch_pairing_ids
    )

    log(
      `Batch ${current_batch_number}: loaded ${current_batch_props.length} props`
    )

    // Create lookup for this batch
    const props_lookup_by_pairing_id = current_batch_props.reduce(
      (lookup, prop) => {
        if (!lookup[prop.pairing_id]) {
          lookup[prop.pairing_id] = []
        }
        lookup[prop.pairing_id].push(prop)
        return lookup
      },
      {}
    )

    // Attach props to pairings
    for (const pairing of current_batch_pairings) {
      pairing.props = props_lookup_by_pairing_id[pairing.pairing_id] || []
    }

    // Filter this batch
    const current_batch_filtered = filter_batch(
      current_batch_pairings,
      nfl_team_seasonlogs,
      opts,
      filter_by_allowed_over_average,
      unique_index,
      team_index
    )

    filtered.push(...current_batch_filtered)

    log(
      `Batch ${current_batch_number}: ${current_batch_filtered.length} passed filters (total filtered: ${filtered.length})`
    )

    current_offset += PAIRING_BATCH_SIZE
    current_batch_number++

    // Optional: Force garbage collection if available
    if (global.gc) {
      global.gc()
      log(`Batch ${current_batch_number - 1}: garbage collection triggered`)
    }
  }

  log(
    `Finished processing ${current_batch_number - 1} batches, ${total_loaded_count} total pairings, ${filtered.length} passed filters`
  )

  /**
   * Calculates summary statistics for filtered prop pairings
   * @param {Array} filtered_pairings - Array of filtered prop pairings
   * @returns {Object} Summary statistics
   */
  const calculate_summary_stats = (filtered_pairings) => {
    return filtered_pairings.reduce(
      (summary_stats, prop_pairing) => {
        if (prop_pairing.is_pending) {
          return {
            ...summary_stats,
            pending: summary_stats.pending + 1,
            total_payout:
              summary_stats.total_payout + prop_pairing.payout_total,
            total_risk: summary_stats.total_risk + prop_pairing.risk_total
          }
        } else {
          return {
            hits: prop_pairing.is_success
              ? summary_stats.hits + 1
              : summary_stats.hits,
            current_season_hist_rate_soft:
              summary_stats.current_season_hist_rate_soft +
              prop_pairing.current_season_hist_rate_soft,
            current_season_hist_rate_hard:
              summary_stats.current_season_hist_rate_hard +
              prop_pairing.current_season_hist_rate_hard,
            market_prob: summary_stats.market_prob + prop_pairing.market_prob,
            completed: summary_stats.completed + 1,
            total_payout:
              summary_stats.total_payout + prop_pairing.payout_total,
            total_risk: summary_stats.total_risk + prop_pairing.risk_total
          }
        }
      },
      {
        hits: 0,
        completed: 0,
        pending: 0,
        total_payout: 0,
        total_risk: 0,
        current_season_hist_rate_soft: 0,
        current_season_hist_rate_hard: 0,
        market_prob: 0
      }
    )
  }

  const summary_stats = calculate_summary_stats(filtered)
  const filtered_prop_sets_path = `${data_path}/prop_sets_filtered.json`
  await fs.writeJson(filtered_prop_sets_path, filtered, { spaces: 2 })

  log(`Plays: ${filtered.length}`)
  log(`Completed: ${summary_stats.completed}`)
  log(`Hits: ${summary_stats.hits}`)
  log(
    `Hit Rate: ${((summary_stats.hits / summary_stats.completed) * 100).toFixed(2)}%`
  )
  log(
    `Hits Over Market Expectation: ${(
      summary_stats.hits - summary_stats.market_prob
    ).toFixed(2)}`
  )
  log(
    `Hits Over Historical Expectation: ${(
      summary_stats.hits - summary_stats.current_season_hist_rate_soft
    ).toFixed(2)}`
  )
  log(
    `Payout (units): ${summary_stats.total_payout.toFixed(
      1
    )}\tRisk (units): ${summary_stats.total_risk.toFixed(1)}`
  )

  log('Plays')

  const plays_grouped_by_team = groupBy(filtered, 'team')
  for (const team_name in plays_grouped_by_team) {
    const team_plays_table = new Table({
      title: `${team_name} plays`,
      columns: [
        { name: 'prop_1', alignment: 'left' },
        { name: 'prop_2', alignment: 'left' },
        { name: 'prop_3', alignment: 'left' },
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

    plays_grouped_by_team[team_name].forEach((prop_pairing) => {
      const sorted_props_by_odds = prop_pairing.props.sort(
        (a, b) => a.odds_american - b.odds_american
      )
      const formatted_prop_names = sorted_props_by_odds.map(
        (prop) =>
          `${prop.name} [${Math.round(prop.current_season_hit_rate_hard * 100)}% / ${prop.odds_american}]`
      )

      team_plays_table.addRow({
        prop_1: formatted_prop_names[0] || '',
        prop_2: formatted_prop_names[1] || '',
        prop_3: formatted_prop_names[2] || '',
        current_season_soft: `${Math.round(prop_pairing.current_season_hist_rate_soft * 100)}%`,
        current_season_hard: `${Math.round(prop_pairing.current_season_hist_rate_hard * 100)}%`,
        current_season_edge: `${(prop_pairing.current_season_hist_edge_soft * 100).toFixed(1)}%`,
        last_5_soft: `${Math.round(prop_pairing.last_five_hist_rate_soft * 100)}%`,
        last_10_soft: `${Math.round(prop_pairing.last_ten_hist_rate_soft * 100)}%`,
        high: prop_pairing.highest_payout,
        low: prop_pairing.lowest_payout,
        current_season_sum: `${Math.round(prop_pairing.current_season_sum_hist_rate_soft * 100)}%`
      })
    })

    team_plays_table.printTable()
  }

  log('Plays By Team')
  const filtered_plays_by_team = groupBy(filtered, 'team')
  for (const team_name of Object.keys(filtered_plays_by_team)) {
    log(`${team_name}: ${filtered_plays_by_team[team_name].length}`)
  }
}

/**
 * Main entry point for the script
 * Parses command line arguments and runs the prop pairing filter
 */
const main = async () => {
  try {
    const argv = initialize_cli()
    const { week, source, filter_by_allowed_over_average } = argv

    log('Starting prop pairing filter with parameters:', {
      week,
      source,
      filter_by_allowed_over_average
    })

    await filter_prop_pairings({
      week,
      source,
      filter_by_allowed_over_average
    })

    log('Prop pairing filter completed successfully')
  } catch (error) {
    log('Error occurred during prop pairing filter:', error)
    console.error('Fatal error:', error.message)
    process.exit(1)
  }

  process.exit(0)
}

// Run main function if this script is executed directly
if (is_main(import.meta.url)) {
  main()
}

export default filter_prop_pairings
