import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import * as oddslib from 'oddslib'

import db from '#db'
import { is_main, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { current_season } from '#constants'
import { chunk_array } from '#libs-shared/chunk.mjs'
import { team_game_market_types } from '#libs-shared/bookmaker-constants.mjs'

const log = debug('calculate-team-historical-hit-rates')
debug.enable('calculate-team-historical-hit-rates')

const TEAM_YARDAGE_MARKET_TYPES = [
  team_game_market_types.GAME_TEAM_TOTAL_YARDS,
  team_game_market_types.GAME_TEAM_ALT_TOTAL_YARDS,
  team_game_market_types.GAME_TEAM_ALT_RUSHING_YARDS,
  team_game_market_types.GAME_TEAM_ALT_RECEIVING_YARDS,
  team_game_market_types.GAME_TEAM_FIRST_HALF_TOTAL_YARDS,
  team_game_market_types.GAME_TEAM_FIRST_HALF_ALT_TOTAL_YARDS,
  team_game_market_types.GAME_TEAM_FIRST_HALF_RUSHING_YARDS,
  team_game_market_types.GAME_TEAM_FIRST_HALF_ALT_RUSHING_YARDS,
  team_game_market_types.GAME_TEAM_FIRST_HALF_ALT_RECEIVING_YARDS,
  team_game_market_types.GAME_TEAM_FIRST_QUARTER_ALT_TOTAL_YARDS,
  team_game_market_types.GAME_TEAM_FIRST_QUARTER_RUSHING_YARDS,
  team_game_market_types.GAME_TEAM_FIRST_QUARTER_ALT_RUSHING_YARDS,
  team_game_market_types.GAME_TEAM_FIRST_QUARTER_RECEIVING_YARDS,
  team_game_market_types.GAME_TEAM_FIRST_QUARTER_ALT_RECEIVING_YARDS
]

const get_cushion_for_team_market_type = (market_type) => {
  if (market_type.includes('TOTAL_YARDS')) {
    return 0.06
  }
  return 0.12
}

const get_metric_type_for_market = (market_type) => {
  if (market_type.includes('RUSHING')) {
    return 'rushing'
  }
  if (market_type.includes('RECEIVING')) {
    return 'receiving'
  }
  return 'total'
}

const get_period_filter_for_market = (market_type) => {
  if (market_type.includes('FIRST_QUARTER')) {
    return { quarters: [1] }
  }
  if (market_type.includes('FIRST_HALF')) {
    return { quarters: [1, 2] }
  }
  return { quarters: [1, 2, 3, 4] }
}

const calculate_hit_rate = (hits, total) => {
  return total > 0 ? hits / total : 0
}

const is_hit = ({ actual_value, line, selection_type, strict, cushion }) => {
  const cushion_amount = strict ? 0 : line * cushion

  if (selection_type === 'OVER') {
    return strict ? actual_value > line : actual_value >= line - cushion_amount
  } else if (selection_type === 'UNDER') {
    return strict ? actual_value < line : actual_value <= line + cushion_amount
  }

  return false
}

const get_team_yardage_markets = async ({ year, current_week_only }) => {
  const query = db('prop_market_selections_index')
    .select(
      'prop_markets_index.esbid',
      'prop_markets_index.market_type',
      'prop_market_selections_index.selection_pid as team',
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
    .whereNotNull('prop_markets_index.esbid')
    .whereNotNull('prop_market_selections_index.selection_pid')
    .where('prop_markets_index.year', year)
    .whereIn('prop_markets_index.market_type', TEAM_YARDAGE_MARKET_TYPES)
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

  if (current_week_only) {
    query
      .where('nfl_games.week', current_season.nfl_seas_week)
      .where('nfl_games.seas_type', current_season.nfl_seas_type)
  }

  return query
}

const aggregate_team_game_yards = async ({ teams }) => {
  const plays = await db('nfl_plays')
    .select('esbid', 'off', 'qtr', 'rush_yds', 'recv_yds')
    .whereIn('off', teams)
    .whereNot('play_type', 'NOPL')

  const aggregated = {}

  for (const play of plays) {
    const key = `${play.esbid}:${play.off}`
    if (!aggregated[key]) {
      aggregated[key] = {
        esbid: play.esbid,
        team: play.off,
        full_game: { rushing: 0, receiving: 0, total: 0 },
        first_half: { rushing: 0, receiving: 0, total: 0 },
        first_quarter: { rushing: 0, receiving: 0, total: 0 }
      }
    }

    const rushing = play.rush_yds || 0
    const receiving = play.recv_yds || 0

    aggregated[key].full_game.rushing += rushing
    aggregated[key].full_game.receiving += receiving
    aggregated[key].full_game.total += rushing + receiving

    if (play.qtr === 1 || play.qtr === 2) {
      aggregated[key].first_half.rushing += rushing
      aggregated[key].first_half.receiving += receiving
      aggregated[key].first_half.total += rushing + receiving
    }

    if (play.qtr === 1) {
      aggregated[key].first_quarter.rushing += rushing
      aggregated[key].first_quarter.receiving += receiving
      aggregated[key].first_quarter.total += rushing + receiving
    }
  }

  return aggregated
}

const get_game_info_for_esbids = async ({ esbids }) => {
  const games = await db('nfl_games')
    .select('esbid', 'year', 'week', 'seas_type')
    .whereIn('esbid', esbids)

  const game_info = {}
  for (const game of games) {
    game_info[game.esbid] = game
  }
  return game_info
}

const filter_games_by_period = ({
  team_games,
  period,
  selection_year,
  selection_week,
  selection_seas_type,
  game_info
}) => {
  return team_games.filter((game) => {
    const info = game_info[game.esbid]
    if (!info) return false

    const is_before_selection =
      info.year < selection_year ||
      (info.year === selection_year &&
        ((selection_seas_type === 'POST' && info.seas_type === 'REG') ||
          (info.seas_type === selection_seas_type &&
            info.week < selection_week)))

    if (!is_before_selection) return false

    switch (period) {
      case 'current_season':
        return info.year === selection_year && info.seas_type !== 'POST'
      case 'last_season':
        return info.year === selection_year - 1
      case 'overall':
        return true
      default:
        return true
    }
  })
}

const calculate_team_hit_rates = ({
  games,
  market_type,
  line,
  selection_type
}) => {
  const cushion = get_cushion_for_team_market_type(market_type)
  const metric_type = get_metric_type_for_market(market_type)
  const period_filter = get_period_filter_for_market(market_type)

  let period_key = 'full_game'
  if (period_filter.quarters.length === 1) {
    period_key = 'first_quarter'
  } else if (period_filter.quarters.length === 2) {
    period_key = 'first_half'
  }

  const hits_soft = games.filter((game) => {
    const actual_value = game[period_key][metric_type]
    return is_hit({
      actual_value,
      line,
      selection_type,
      strict: false,
      cushion
    })
  })

  const hits_hard = games.filter((game) => {
    const actual_value = game[period_key][metric_type]
    return is_hit({ actual_value, line, selection_type, strict: true, cushion })
  })

  return {
    hit_rate_soft: calculate_hit_rate(hits_soft.length, games.length),
    hit_rate_hard: calculate_hit_rate(hits_hard.length, games.length)
  }
}

const calculate_team_historical_hit_rates = async ({
  year = current_season.year,
  current_week_only = false,
  dry_run = false,
  batch_size = 1000
} = {}) => {
  log('Starting team historical hit rate calculation')

  const selections = await get_team_yardage_markets({ year, current_week_only })
  log(`Processing ${selections.length} team yardage selections`)

  if (selections.length === 0) {
    log('No selections found to process')
    return
  }

  const unique_teams = [...new Set(selections.map((s) => s.team))]
  log(`Loading play data for ${unique_teams.length} unique teams`)

  const team_game_yards = await aggregate_team_game_yards({
    teams: unique_teams
  })
  const all_esbids = [
    ...new Set(Object.values(team_game_yards).map((g) => g.esbid))
  ]
  const game_info = await get_game_info_for_esbids({ esbids: all_esbids })

  log(`Loaded ${Object.keys(team_game_yards).length} team game records`)

  const batches = chunk_array({ items: selections, chunk_size: batch_size })
  log(`Processing ${batches.length} batches of up to ${batch_size} selections`)

  let processed_count = 0

  for (const [batch_index, batch] of batches.entries()) {
    log(`Processing batch ${batch_index + 1}/${batches.length}`)

    const batch_updates = []

    for (const selection of batch) {
      const team = selection.team

      const team_games = Object.values(team_game_yards).filter(
        (g) => g.team === team
      )

      if (team_games.length === 0) {
        continue
      }

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

      const calculate_rates_for_period = (period) => {
        const filtered_games = filter_games_by_period({
          team_games,
          period,
          selection_year: selection.year,
          selection_week: selection.week,
          selection_seas_type: selection.seas_type,
          game_info
        })

        if (period === 'last_five') {
          const all_games = filter_games_by_period({
            team_games,
            period: 'overall',
            selection_year: selection.year,
            selection_week: selection.week,
            selection_seas_type: selection.seas_type,
            game_info
          })
          return calculate_team_hit_rates({
            games: all_games.slice(-5),
            market_type: selection.market_type,
            line: selection.selection_metric_line,
            selection_type: selection.selection_type
          })
        }

        if (period === 'last_ten') {
          const all_games = filter_games_by_period({
            team_games,
            period: 'overall',
            selection_year: selection.year,
            selection_week: selection.week,
            selection_seas_type: selection.seas_type,
            game_info
          })
          return calculate_team_hit_rates({
            games: all_games.slice(-10),
            market_type: selection.market_type,
            line: selection.selection_metric_line,
            selection_type: selection.selection_type
          })
        }

        return calculate_team_hit_rates({
          games: filtered_games,
          market_type: selection.market_type,
          line: selection.selection_metric_line,
          selection_type: selection.selection_type
        })
      }

      const current_season_rates = calculate_rates_for_period('current_season')
      const last_five_rates = calculate_rates_for_period('last_five')
      const last_ten_rates = calculate_rates_for_period('last_ten')
      const last_season_rates = calculate_rates_for_period('last_season')
      const overall_rates = calculate_rates_for_period('overall')

      const update_data = {
        current_season_hit_rate_soft: current_season_rates.hit_rate_soft,
        current_season_hit_rate_hard: current_season_rates.hit_rate_hard,
        current_season_edge_soft: implied_probability
          ? current_season_rates.hit_rate_soft - implied_probability
          : null,
        current_season_edge_hard: implied_probability
          ? current_season_rates.hit_rate_hard - implied_probability
          : null,

        last_five_hit_rate_soft: last_five_rates.hit_rate_soft,
        last_five_hit_rate_hard: last_five_rates.hit_rate_hard,
        last_five_edge_soft: implied_probability
          ? last_five_rates.hit_rate_soft - implied_probability
          : null,
        last_five_edge_hard: implied_probability
          ? last_five_rates.hit_rate_hard - implied_probability
          : null,

        last_ten_hit_rate_soft: last_ten_rates.hit_rate_soft,
        last_ten_hit_rate_hard: last_ten_rates.hit_rate_hard,
        last_ten_edge_soft: implied_probability
          ? last_ten_rates.hit_rate_soft - implied_probability
          : null,
        last_ten_edge_hard: implied_probability
          ? last_ten_rates.hit_rate_hard - implied_probability
          : null,

        last_season_hit_rate_soft: last_season_rates.hit_rate_soft,
        last_season_hit_rate_hard: last_season_rates.hit_rate_hard,
        last_season_edge_soft: implied_probability
          ? last_season_rates.hit_rate_soft - implied_probability
          : null,
        last_season_edge_hard: implied_probability
          ? last_season_rates.hit_rate_hard - implied_probability
          : null,

        overall_hit_rate_soft: overall_rates.hit_rate_soft,
        overall_hit_rate_hard: overall_rates.hit_rate_hard,
        overall_edge_soft: implied_probability
          ? overall_rates.hit_rate_soft - implied_probability
          : null,
        overall_edge_hard: implied_probability
          ? overall_rates.hit_rate_hard - implied_probability
          : null
      }

      batch_updates.push({
        where_clause: {
          source_id: selection.source_id,
          source_market_id: selection.source_market_id,
          source_selection_id: selection.source_selection_id,
          selection_type: selection.selection_type,
          selection_metric_line: selection.selection_metric_line
        },
        update_data
      })

      processed_count++
    }

    if (!dry_run) {
      log(
        `Executing ${batch_updates.length} updates for batch ${batch_index + 1}`
      )
      for (const update of batch_updates) {
        await db('prop_market_selections_index')
          .where(update.where_clause)
          .update(update.update_data)
      }
    } else {
      log(
        `[DRY RUN] Would execute ${batch_updates.length} updates for batch ${batch_index + 1}`
      )
    }

    if ((batch_index + 1) % 10 === 0) {
      log(`Completed ${batch_index + 1}/${batches.length} batches`)
    }
  }

  log('Team historical hit rate calculation completed')
  log(`Total selections processed: ${processed_count}`)
}

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .usage(
      '$0 [options]',
      'Calculate historical hit rates for team yardage market selections'
    )
    .option('year', {
      type: 'number',
      describe: 'Season year to process',
      default: current_season.year
    })
    .option('current_week_only', {
      type: 'boolean',
      default: false,
      describe: 'Only process current NFL week'
    })
    .option('dry_run', {
      alias: 'dry',
      type: 'boolean',
      default: false,
      describe: 'Run without making database updates'
    })
    .option('batch_size', {
      type: 'number',
      default: 1000,
      describe: 'Number of selections to process per batch'
    })
    .example('$0 --dry_run', 'Preview updates without applying')
    .example('$0 --current_week_only', 'Process only current week')
    .help()
    .parse()
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    await calculate_team_historical_hit_rates({
      year: argv.year,
      current_week_only: argv.current_week_only,
      dry_run: argv.dry_run,
      batch_size: argv.batch_size
    })
  } catch (err) {
    error = err
    log(`Error in team hit rate calculation: ${error.message}`)
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

export default calculate_team_historical_hit_rates
