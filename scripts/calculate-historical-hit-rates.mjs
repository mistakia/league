import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import * as oddslib from 'oddslib'

import db from '#db'
import { is_main, report_job, selection_result } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { groupBy, constants } from '#libs-shared'
import { chunk_array } from '#libs-shared/chunk.mjs'
import {
  player_game_prop_types
} from '#libs-shared/bookmaker-constants.mjs'

const argv = yargs(hideBin(process.argv))
  .usage(
    '$0 [options]',
    'Calculate historical hit rates for prop market selections'
  )
  .option('year', {
    type: 'number',
    describe: 'Season year to process',
    default: constants.season.year
  })
  .option('missing_only', {
    type: 'boolean',
    default: false,
    describe: 'Only process selections missing hit rate data'
  })
  .option('current_week_only', {
    type: 'boolean',
    default: false,
    describe: 'Only process current NFL week'
  })
  .option('market_types', {
    type: 'array',
    describe: 'Specific market types to process (optional)'
  })
  .option('batch_size', {
    type: 'number',
    default: 1000,
    describe: 'Number of selections to process per batch'
  })
  .example('$0 --missing_only', 'Process only missing hit rates')
  .example(
    '$0 --market_types GAME_PASSING_YARDS',
    'Process specific market type'
  )
  .help()
  .parse()

const log = debug('calculate-historical-hit-rates')
debug.enable('calculate-historical-hit-rates')

const calculate_hit_rate = (hits, total) => {
  return total > 0 ? hits / total : 0
}

const get_hits = ({
  line,
  market_type,
  player_gamelogs,
  strict,
  selection_type
}) => {
  const unsupported_market_types = new Set()
  return player_gamelogs.filter((player_gamelog) =>
    selection_result.is_hit({
      line,
      market_type,
      player_gamelog,
      strict,
      selection_type,
      unsupported_market_types
    })
  )
}

const calculate_historical_hit_rates = async ({
  year = constants.season.year,
  missing_only = false,
  current_week_only = false,
  market_types = null,
  batch_size = 1000
} = {}) => {
  log('Starting historical hit rate calculation')

  // Build base query for prop selections
  const prop_selections_query = db('prop_market_selections_index')
    .select(
      'prop_markets_index.esbid',
      'prop_markets_index.market_type',
      'prop_market_selections_index.selection_pid',
      'prop_market_selections_index.selection_metric_line',
      'prop_market_selections_index.selection_type',
      'prop_market_selections_index.source_id',
      'prop_market_selections_index.source_market_id',
      'prop_market_selections_index.source_selection_id',
      'prop_market_selections_index.odds_american',
      'nfl_games.seas_type',
      'nfl_games.week',
      'nfl_games.year'
    )
    .whereNotNull('prop_market_selections_index.selection_pid')
    .whereNotNull('prop_markets_index.esbid')
    .where('prop_markets_index.year', year)
    .join('prop_markets_index', function () {
      this.on(
        'prop_markets_index.source_id',
        '=',
        'prop_market_selections_index.source_id'
      ).andOn(
        'prop_markets_index.source_market_id',
        '=',
        'prop_market_selections_index.source_market_id'
      )
    })
    .join('nfl_games', 'nfl_games.esbid', 'prop_markets_index.esbid')
    .groupBy(
      'prop_markets_index.esbid',
      'prop_markets_index.market_type',
      'prop_market_selections_index.selection_pid',
      'prop_market_selections_index.selection_metric_line',
      'prop_market_selections_index.selection_type',
      'prop_market_selections_index.source_id',
      'prop_market_selections_index.source_market_id',
      'prop_market_selections_index.source_selection_id',
      'prop_market_selections_index.odds_american',
      'nfl_games.seas_type',
      'nfl_games.week',
      'nfl_games.year'
    )

  // Apply filters
  if (missing_only) {
    prop_selections_query.where(function () {
      this.whereNull(
        'prop_market_selections_index.overall_hit_rate_hard'
      ).orWhereNull('prop_market_selections_index.current_season_hit_rate_soft')
    })
  }

  if (current_week_only) {
    prop_selections_query
      .where('nfl_games.week', constants.season.nfl_seas_week)
      .where('nfl_games.seas_type', constants.season.nfl_seas_type)
  }

  if (market_types && market_types.length > 0) {
    prop_selections_query.whereIn(
      'prop_markets_index.market_type',
      market_types
    )
  } else {
    // Default to player game prop types if no specific types provided
    prop_selections_query.whereIn(
      'prop_markets_index.market_type',
      Object.values(player_game_prop_types)
    )
  }

  const prop_selections = await prop_selections_query
  log(`Processing ${prop_selections.length} prop selections`)

  if (prop_selections.length === 0) {
    log('No selections found to process')
    return
  }

  // Get unique player IDs for gamelog fetching
  const unique_pids = [...new Set(prop_selections.map((s) => s.selection_pid))]
  log(`Loading gamelogs for ${unique_pids.length} unique players`)

  // Fetch all relevant player gamelogs
  const player_gamelogs = await db('player_gamelogs')
    .select(
      'player_gamelogs.*',
      'nfl_games.week',
      'nfl_games.year',
      'nfl_games.seas_type',
      'nfl_games.esbid'
    )
    .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .whereIn('nfl_games.seas_type', ['REG', 'POST'])
    .whereIn('player_gamelogs.pid', unique_pids).orderByRaw(`
      nfl_games.year,
      CASE WHEN nfl_games.seas_type = 'REG' THEN 0 ELSE 1 END,
      nfl_games.week
    `)

  log(`Loaded ${player_gamelogs.length} player gamelogs`)

  // Fetch first quarter stats if needed
  const first_quarter_stats = await db('nfl_plays')
    .select(
      'esbid',
      'pass_yds',
      'recv_yds',
      'rush_yds',
      'psr_pid',
      'trg_pid',
      'bc_pid'
    )
    .whereIn(
      'esbid',
      player_gamelogs.map((g) => g.esbid)
    )
    .where('qtr', 1)
    .whereNot('play_type', 'NOPL')

  // Process first quarter stats into lookup
  const first_quarter_stats_by_game = first_quarter_stats.reduce(
    (acc, play) => {
      if (!acc[play.esbid]) {
        acc[play.esbid] = {}
      }

      ;[play.psr_pid, play.bc_pid, play.trg_pid].forEach((pid) => {
        if (!pid) return
        if (!acc[play.esbid][pid]) {
          acc[play.esbid][pid] = {
            passing_yards: 0,
            rushing_yards: 0,
            receiving_yards: 0
          }
        }
      })

      if (play.psr_pid) {
        acc[play.esbid][play.psr_pid].passing_yards += play.pass_yds || 0
      }
      if (play.bc_pid) {
        acc[play.esbid][play.bc_pid].rushing_yards += play.rush_yds || 0
      }
      if (play.trg_pid) {
        acc[play.esbid][play.trg_pid].receiving_yards += play.recv_yds || 0
      }

      return acc
    },
    {}
  )

  // Fetch first half stats if needed (quarters 1 and 2)
  const first_half_stats = await db('nfl_plays')
    .select(
      'esbid',
      'pass_yds',
      'recv_yds',
      'rush_yds',
      'psr_pid',
      'trg_pid',
      'bc_pid'
    )
    .whereIn(
      'esbid',
      player_gamelogs.map((g) => g.esbid)
    )
    .whereIn('qtr', [1, 2])
    .whereNot('play_type', 'NOPL')

  // Process first half stats into lookup
  const first_half_stats_by_game = first_half_stats.reduce((acc, play) => {
    if (!acc[play.esbid]) {
      acc[play.esbid] = {}
    }

    ;[play.psr_pid, play.bc_pid, play.trg_pid].forEach((pid) => {
      if (!pid) return
      if (!acc[play.esbid][pid]) {
        acc[play.esbid][pid] = {
          passing_yards: 0,
          rushing_yards: 0,
          receiving_yards: 0
        }
      }
    })

    if (play.psr_pid) {
      acc[play.esbid][play.psr_pid].passing_yards += play.pass_yds || 0
    }
    if (play.bc_pid) {
      acc[play.esbid][play.bc_pid].rushing_yards += play.rush_yds || 0
    }
    if (play.trg_pid) {
      acc[play.esbid][play.trg_pid].receiving_yards += play.recv_yds || 0
    }

    return acc
  }, {})

  // Enhance player gamelogs with first quarter and first half stats
  const enhanced_player_gamelogs = player_gamelogs.map((gamelog) => ({
    ...gamelog,
    first_quarter_stats: first_quarter_stats_by_game[`${gamelog.esbid}`]?.[
      gamelog.pid
    ] || {
      passing_yards: 0,
      rushing_yards: 0,
      receiving_yards: 0
    },
    first_half_stats: first_half_stats_by_game[`${gamelog.esbid}`]?.[
      gamelog.pid
    ] || {
      passing_yards: 0,
      rushing_yards: 0,
      receiving_yards: 0
    }
  }))

  const player_gamelogs_by_pid = groupBy(enhanced_player_gamelogs, 'pid')

  // Process selections in batches
  const batches = chunk_array({
    items: prop_selections,
    chunk_size: batch_size
  })

  log(
    `Processing ${batches.length} batches of up to ${batch_size} selections each`
  )

  let processed_count = 0
  let missing_gamelogs_count = 0
  const missing_gamelogs_pids = new Set()

  for (const [batch_index, batch] of batches.entries()) {
    log(`Processing batch ${batch_index + 1}/${batches.length}`)

    const batch_updates = []

    for (const selection of batch) {
      const player_gamelogs = player_gamelogs_by_pid[selection.selection_pid]

      if (!player_gamelogs) {
        missing_gamelogs_pids.add(selection.selection_pid)
        missing_gamelogs_count++
        continue
      }

      // Filter gamelogs by time periods
      const current_season_gamelogs = player_gamelogs.filter(
        (g) =>
          g.year === selection.year &&
          ((selection.seas_type === 'POST' && g.seas_type === 'REG') ||
            (g.seas_type === selection.seas_type && g.week < selection.week))
      )

      const all_gamelogs = player_gamelogs.filter(
        (g) =>
          g.year < selection.year ||
          (g.year === selection.year &&
            ((selection.seas_type === 'POST' && g.seas_type === 'REG') ||
              (g.seas_type === selection.seas_type && g.week < selection.week)))
      )

      const last_five = all_gamelogs.slice(-5)
      const last_ten = all_gamelogs.slice(-10)
      const last_season = all_gamelogs.filter(
        (g) => g.year === selection.year - 1
      )

      // Calculate implied probability from odds
      let implied_probability = null
      if (selection.odds_american) {
        try {
          implied_probability = oddslib
            .from('moneyline', selection.odds_american)
            .to('impliedProbability')
        } catch (err) {
          log(
            `Error calculating implied probability for odds ${selection.odds_american}`
          )
        }
      }

      // Calculate rates for different time periods
      const calculate_rates = (gamelogs) => {
        const hits_soft = get_hits({
          line: selection.selection_metric_line,
          market_type: selection.market_type,
          player_gamelogs: gamelogs,
          strict: false,
          selection_type: selection.selection_type
        })

        const hits_hard = get_hits({
          line: selection.selection_metric_line,
          market_type: selection.market_type,
          player_gamelogs: gamelogs,
          strict: true,
          selection_type: selection.selection_type
        })

        const hit_rate_soft = calculate_hit_rate(
          hits_soft.length,
          gamelogs.length
        )
        const hit_rate_hard = calculate_hit_rate(
          hits_hard.length,
          gamelogs.length
        )

        return {
          hit_rate_soft,
          hit_rate_hard,
          edge_soft: implied_probability
            ? hit_rate_soft - implied_probability
            : null,
          edge_hard: implied_probability
            ? hit_rate_hard - implied_probability
            : null
        }
      }

      const current_season_rates = calculate_rates(current_season_gamelogs)
      const last_five_rates = calculate_rates(last_five)
      const last_ten_rates = calculate_rates(last_ten)
      const last_season_rates = calculate_rates(last_season)
      const overall_rates = calculate_rates(all_gamelogs)

      // Prepare update data
      const update_data = {
        current_season_hit_rate_soft: current_season_rates.hit_rate_soft,
        current_season_hit_rate_hard: current_season_rates.hit_rate_hard,
        current_season_edge_soft: current_season_rates.edge_soft,
        current_season_edge_hard: current_season_rates.edge_hard,

        last_five_hit_rate_soft: last_five_rates.hit_rate_soft,
        last_five_hit_rate_hard: last_five_rates.hit_rate_hard,
        last_five_edge_soft: last_five_rates.edge_soft,
        last_five_edge_hard: last_five_rates.edge_hard,

        last_ten_hit_rate_soft: last_ten_rates.hit_rate_soft,
        last_ten_hit_rate_hard: last_ten_rates.hit_rate_hard,
        last_ten_edge_soft: last_ten_rates.edge_soft,
        last_ten_edge_hard: last_ten_rates.edge_hard,

        last_season_hit_rate_soft: last_season_rates.hit_rate_soft,
        last_season_hit_rate_hard: last_season_rates.hit_rate_hard,
        last_season_edge_soft: last_season_rates.edge_soft,
        last_season_edge_hard: last_season_rates.edge_hard,

        overall_hit_rate_soft: overall_rates.hit_rate_soft,
        overall_hit_rate_hard: overall_rates.hit_rate_hard,
        overall_edge_soft: overall_rates.edge_soft,
        overall_edge_hard: overall_rates.edge_hard
      }

      batch_updates.push({
        where_clause: {
          source_id: selection.source_id,
          source_market_id: selection.source_market_id,
          source_selection_id: selection.source_selection_id,
          selection_type: selection.selection_type,
          selection_metric_line: selection.selection_metric_line,
          selection_pid: selection.selection_pid
        },
        update_data
      })

      processed_count++
    }

    // Execute batch updates
    log(
      `Executing ${batch_updates.length} updates for batch ${batch_index + 1}`
    )

    for (const update of batch_updates) {
      await db('prop_market_selections_index')
        .where(update.where_clause)
        .update(update.update_data)
    }

    // Log progress
    if ((batch_index + 1) % 10 === 0) {
      log(`Completed ${batch_index + 1}/${batches.length} batches`)
    }
  }

  log('Historical hit rate calculation completed')
  log(`Total selections processed: ${processed_count}`)
  log(`Selections with missing gamelogs: ${missing_gamelogs_count}`)

  if (missing_gamelogs_pids.size > 0) {
    log(`Unique players with missing gamelogs: ${missing_gamelogs_pids.size}`)
  }
}

const main = async () => {
  let error
  try {
    await calculate_historical_hit_rates({
      year: argv.year,
      missing_only: argv.missing_only,
      current_week_only: argv.current_week_only,
      market_types: argv.market_types,
      batch_size: argv.batch_size
    })
  } catch (err) {
    error = err
    log(`Error in hit rate calculation: ${error.message}`)
    console.error(error)
  }

  await report_job({
    job_type: job_types.PROCESS_MARKET_HIT_RATES,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default calculate_historical_hit_rates
