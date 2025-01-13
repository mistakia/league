import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import * as oddslib from 'oddslib'

import db from '#db'
import { is_main, report_job, selection_result } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { groupBy, constants } from '#libs-shared'
import { player_game_prop_types } from '#libs-shared/bookmaker-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-market-selection-hit-rates')
debug.enable('process-market-selection-hit-rates')
const unsupported_market_types = new Set()

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
    selection_result.is_hit({
      line,
      market_type,
      player_gamelog,
      strict,
      selection_type,
      unsupported_market_types
    })
  )

const process_market_selection_hit_rates = async ({
  year = constants.season.year,
  missing_only = false,
  current_week_only = false
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

  if (current_week_only) {
    prop_selections_query.where(
      'nfl_games.week',
      constants.season.nfl_seas_week
    )
    prop_selections_query.where(
      'nfl_games.seas_type',
      constants.season.nfl_seas_type
    )
  }

  const prop_selections = await prop_selections_query

  log(`Processing ${prop_selections.length} prop selections`)

  const unique_pids = [...new Set(prop_selections.map((s) => s.selection_pid))]

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

  const nfl_plays = await db('nfl_plays')
    .select(
      'esbid',
      'qtr',
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
    .where('nfl_plays.qtr', 1)
    .whereNot('play_type', 'NOPL')
    .orderBy('esbid')

  const first_quarter_stats_by_game = nfl_plays.reduce((acc, play) => {
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

  const enhanced_player_gamelogs = player_gamelogs.map((gamelog) => ({
    ...gamelog,
    first_quarter_stats: first_quarter_stats_by_game[`${gamelog.esbid}`]?.[
      gamelog.pid
    ] || {
      passing_yards: 0,
      rushing_yards: 0,
      receiving_yards: 0
    }
  }))
  const player_gamelogs_by_pid = groupBy(enhanced_player_gamelogs, 'pid')

  const missing_gamelogs_pids = new Set()
  const missing_gamelogs_selections = {}

  const market_updates = {}

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

    let implied_probability = null

    if (selection.odds_american) {
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
      }
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
      const wager_status = selection_result.get_selection_result({
        line: selection.selection_metric_line,
        market_type: selection.market_type,
        player_gamelog: selection_gamelog,
        strict: true,
        selection_type: selection.selection_type,
        unsupported_market_types
      })

      update.result = wager_status

      const market_key = `${selection.source_id}:${selection.source_market_id}`
      if (!market_updates[market_key]) {
        market_updates[market_key] = {
          source_id: selection.source_id,
          source_market_id: selection.source_market_id,
          winning_selection_id: null,
          metric_result_value: null
        }
      }

      const metric_result_value = get_metric_result_value(
        selection_gamelog,
        selection.market_type
      )
      market_updates[market_key].metric_result_value = metric_result_value

      if (wager_status === 'WON') {
        market_updates[market_key].winning_selection_id =
          selection.source_selection_id
      }
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

  for (const market_update of Object.values(market_updates)) {
    await db('prop_markets_index')
      .where({
        source_id: market_update.source_id,
        source_market_id: market_update.source_market_id
      })
      .update({
        winning_selection_id: market_update.winning_selection_id,
        metric_result_value: market_update.metric_result_value
      })
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

const get_metric_result_value = (player_gamelog, market_type) => {
  switch (market_type) {
    case player_game_prop_types.GAME_PASSING_YARDS:
    case player_game_prop_types.GAME_ALT_PASSING_YARDS:
      return player_gamelog.py

    case player_game_prop_types.GAME_RUSHING_YARDS:
    case player_game_prop_types.GAME_ALT_RUSHING_YARDS:
      return player_gamelog.ry

    case player_game_prop_types.GAME_RECEIVING_YARDS:
    case player_game_prop_types.GAME_ALT_RECEIVING_YARDS:
      return player_gamelog.recy

    case player_game_prop_types.GAME_ALT_PASSING_COMPLETIONS:
    case player_game_prop_types.GAME_PASSING_COMPLETIONS:
      return player_gamelog.pc

    case player_game_prop_types.GAME_ALT_PASSING_TOUCHDOWNS:
    case player_game_prop_types.GAME_PASSING_TOUCHDOWNS:
      return player_gamelog.tdp

    case player_game_prop_types.GAME_ALT_RECEPTIONS:
    case player_game_prop_types.GAME_RECEPTIONS:
      return player_gamelog.rec

    case player_game_prop_types.GAME_PASSING_INTERCEPTIONS:
      return player_gamelog.ints

    case player_game_prop_types.GAME_ALT_RUSHING_ATTEMPTS:
    case player_game_prop_types.GAME_RUSHING_ATTEMPTS:
      return player_gamelog.ra

    case player_game_prop_types.GAME_ALT_RUSHING_RECEIVING_YARDS:
    case player_game_prop_types.GAME_RUSHING_RECEIVING_YARDS:
      return player_gamelog.ry + player_gamelog.recy

    case player_game_prop_types.GAME_RECEIVING_TOUCHDOWNS:
      return player_gamelog.tdrec

    case player_game_prop_types.GAME_RUSHING_TOUCHDOWNS:
      return player_gamelog.tdr

    case player_game_prop_types.GAME_PASSING_ATTEMPTS:
      return player_gamelog.pa

    case player_game_prop_types.GAME_RUSHING_RECEIVING_TOUCHDOWNS:
      return player_gamelog.tdr + player_gamelog.tdrec

    case player_game_prop_types.GAME_PASSING_RUSHING_YARDS:
      return player_gamelog.py + player_gamelog.ry

    default:
      log(`Unsupported market type: ${market_type}`)
      return null
  }
}

const main = async () => {
  let error
  try {
    await process_market_selection_hit_rates({
      year: argv.year,
      missing_only: argv.missing_only,
      current_week_only: argv.current_week_only
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
