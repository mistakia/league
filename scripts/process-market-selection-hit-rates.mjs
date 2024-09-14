import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import * as oddslib from 'oddslib'

import db from '#db'
import { is_main, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { groupBy, constants } from '#libs-shared'
import { player_game_prop_types } from '#libs-shared/bookmaker-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-market-selection-hit-rates')
debug.enable('process-market-selection-hit-rates')
const unsupported_market_types = new Set()

const get_result = ({
  line,
  market_type,
  player_gamelog,
  strict,
  selection_type
}) => {
  const compare = (value, line, selection_type) => {
    if (selection_type === 'UNDER' || selection_type === 'NO') {
      if (value < line) return 'WON'
      if (value > line) return 'LOST'
      return 'PUSH'
    } else {
      if (value > line) return 'WON'
      if (value < line) return 'LOST'
      return 'PUSH'
    }
  }

  switch (market_type) {
    case player_game_prop_types.GAME_PASSING_YARDS:
    case player_game_prop_types.GAME_ALT_PASSING_YARDS:
      if (strict) {
        return compare(player_gamelog.py, line, selection_type)
      } else {
        const cushion = Math.min(Math.round(line * 0.06), 16)
        return compare(player_gamelog.py, line - cushion, selection_type)
      }

    case player_game_prop_types.GAME_RUSHING_YARDS:
    case player_game_prop_types.GAME_ALT_RUSHING_YARDS: {
      if (strict) {
        return compare(player_gamelog.ry, line, selection_type)
      } else {
        const cushion = Math.min(Math.round(line * 0.12), 9)
        return compare(player_gamelog.ry, line - cushion, selection_type)
      }
    }

    case player_game_prop_types.GAME_RECEIVING_YARDS:
    case player_game_prop_types.GAME_ALT_RECEIVING_YARDS:
      if (strict) {
        return compare(player_gamelog.recy, line, selection_type)
      } else {
        const cushion = Math.min(Math.round(line * 0.12), 9)
        return compare(player_gamelog.recy, line - cushion, selection_type)
      }

    case player_game_prop_types.GAME_ALT_PASSING_COMPLETIONS:
    case player_game_prop_types.GAME_PASSING_COMPLETIONS:
      return compare(player_gamelog.pc, line, selection_type)

    case player_game_prop_types.GAME_ALT_PASSING_TOUCHDOWNS:
    case player_game_prop_types.GAME_PASSING_TOUCHDOWNS:
      return compare(player_gamelog.tdp, line, selection_type)

    case player_game_prop_types.GAME_ALT_RECEPTIONS:
    case player_game_prop_types.GAME_RECEPTIONS: {
      if (strict) {
        return compare(player_gamelog.rec, line, selection_type)
      } else {
        const cushion = Math.round(line * 0.15)
        return compare(player_gamelog.rec, line - cushion, selection_type)
      }
    }

    case player_game_prop_types.GAME_PASSING_INTERCEPTIONS:
      return compare(player_gamelog.ints, line, selection_type)

    case player_game_prop_types.GAME_ALT_RUSHING_ATTEMPTS:
    case player_game_prop_types.GAME_RUSHING_ATTEMPTS:
      return compare(player_gamelog.ra, line, selection_type)

    case player_game_prop_types.GAME_ALT_RUSHING_RECEIVING_YARDS:
    case player_game_prop_types.GAME_RUSHING_RECEIVING_YARDS:
      return compare(
        player_gamelog.ry + player_gamelog.recy,
        line,
        selection_type
      )

    case player_game_prop_types.GAME_RECEIVING_TOUCHDOWNS:
      return compare(player_gamelog.tdrec, line, selection_type)

    case player_game_prop_types.GAME_RUSHING_TOUCHDOWNS:
      return compare(player_gamelog.tdr, line, selection_type)

    case player_game_prop_types.GAME_PASSING_ATTEMPTS:
      return compare(player_gamelog.pa, line, selection_type)

    // player_game_prop_types.GAME_PASSING_LONGEST_COMPLETION,
    // player_game_prop_types.GAME_LONGEST_RECEPTION,

    case player_game_prop_types.GAME_RUSHING_RECEIVING_TOUCHDOWNS:
      return compare(
        player_gamelog.tdr + player_gamelog.tdrec,
        line,
        selection_type
      )

    // player_game_prop_types.GAME_LONGEST_RUSH,

    case player_game_prop_types.GAME_PASSING_RUSHING_YARDS: {
      if (strict) {
        return compare(
          player_gamelog.py + player_gamelog.ry,
          line,
          selection_type
        )
      } else {
        const cushion = Math.min(Math.round(line * 0.06), 20)
        return compare(
          player_gamelog.py + player_gamelog.ry,
          line - cushion,
          selection_type
        )
      }
    }

    default:
      unsupported_market_types.add(market_type)
      return null
  }
}

const is_hit = (params) => get_result(params) === 'WON'

const calculate_hit_rate = (hits, total) => {
  return total > 0 ? hits / total : 0
}

const get_hits = ({
  line,
  market_type,
  player_gamelogs,
  strict,
  selection_type
}) =>
  player_gamelogs.filter((player_gamelog) =>
    is_hit({ line, market_type, player_gamelog, strict, selection_type })
  )

const process_market_selection_hit_rates = async ({
  year = constants.season.year,
  missing_only = false
} = {}) => {
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
    .whereIn(
      'prop_markets_index.market_type',
      Object.values(player_game_prop_types)
    )
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

  if (missing_only) {
    prop_selections_query.where(function () {
      this.whereNull('prop_market_selections_index.result').orWhereNull(
        'prop_market_selections_index.overall_hit_rate_hard'
      )
    })
  }

  const prop_selections = await prop_selections_query

  log(`Processing ${prop_selections.length} prop selections`)

  const unique_pids = [...new Set(prop_selections.map((s) => s.selection_pid))]

  const player_gamelogs = await db('player_gamelogs')
    .select(
      'player_gamelogs.*',
      'nfl_games.week',
      'nfl_games.year',
      'nfl_games.seas_type'
    )
    .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .whereIn('nfl_games.seas_type', ['REG', 'POST'])
    .whereIn('player_gamelogs.pid', unique_pids).orderByRaw(`
      nfl_games.year,
      CASE WHEN nfl_games.seas_type = 'REG' THEN 0 ELSE 1 END,
      nfl_games.week
    `)

  log(`Loaded ${player_gamelogs.length} player gamelogs`)

  const player_gamelogs_by_pid = groupBy(player_gamelogs, 'pid')

  const missing_gamelogs_pids = new Set()
  const missing_gamelogs_selections = {}

  for (const selection of prop_selections) {
    const player_gamelogs = player_gamelogs_by_pid[selection.selection_pid]

    if (!player_gamelogs) {
      log(
        `No player gamelogs found for selection ${selection.source_selection_id}`
      )
      missing_gamelogs_pids.add(selection.selection_pid)
      if (!missing_gamelogs_selections[selection.selection_pid]) {
        missing_gamelogs_selections[selection.selection_pid] = new Set()
      }
      missing_gamelogs_selections[selection.selection_pid].add(
        selection.source_selection_id
      )
      continue
    }

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

    let implied_probability

    try {
      implied_probability = oddslib
        .from('moneyline', selection.odds_american)
        .to('impliedProbability')
    } catch (err) {
      log(
        `Error calculating implied probability for selection ${selection.source_selection_id} with odds ${selection.odds_american}`
      )
      log(`Selection ID: ${selection.source_selection_id}`)
      log(`Source ID: ${selection.source_id}`)
      log(`Market ID: ${selection.source_market_id}`)

      continue
    }

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

      return {
        hit_rate_soft: calculate_hit_rate(hits_soft.length, gamelogs.length),
        hit_rate_hard: calculate_hit_rate(hits_hard.length, gamelogs.length),
        edge_soft:
          gamelogs.length > 0
            ? calculate_hit_rate(hits_soft.length, gamelogs.length) -
              implied_probability
            : 0,
        edge_hard:
          gamelogs.length > 0
            ? calculate_hit_rate(hits_hard.length, gamelogs.length) -
              implied_probability
            : 0
      }
    }

    const current_season_rates = calculate_rates(current_season_gamelogs)
    const last_five_rates = calculate_rates(last_five)
    const last_ten_rates = calculate_rates(last_ten)
    const last_season_rates = calculate_rates(last_season)
    const overall_rates = calculate_rates(all_gamelogs)

    const update = {
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

    const selection_gamelog = player_gamelogs.find(
      (g) => g.esbid === selection.esbid
    )
    if (selection_gamelog) {
      const wager_status = get_result({
        line: selection.selection_metric_line,
        market_type: selection.market_type,
        player_gamelog: [selection_gamelog],
        strict: true,
        selection_type: selection.selection_type
      })

      update.result = wager_status
    }

    await db('prop_market_selections_index')
      .where({
        source_id: selection.source_id,
        source_market_id: selection.source_market_id,
        source_selection_id: selection.source_selection_id,
        selection_type: selection.selection_type,
        selection_metric_line: selection.selection_metric_line,
        selection_pid: selection.selection_pid
      })
      .update(update)
  }

  if (missing_gamelogs_pids.size > 0) {
    log('Players with missing gamelogs:')
    missing_gamelogs_pids.forEach((pid) => {
      const selection_ids = Array.from(missing_gamelogs_selections[pid]).join(
        ', '
      )
      log(`- Player ID: ${pid}, Impacted Selection IDs: ${selection_ids}`)
    })
  } else {
    log('All selections had corresponding gamelogs.')
  }

  if (unsupported_market_types.size > 0) {
    log('Unsupported market types encountered:')
    unsupported_market_types.forEach((type) => log(`- ${type}`))
  } else {
    log('All market types were supported.')
  }
}

const main = async () => {
  let error
  try {
    await process_market_selection_hit_rates({
      year: argv.year,
      missing_only: argv.missing_only
    })
  } catch (err) {
    error = err
    log(error)
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

export default process_market_selection_hit_rates
