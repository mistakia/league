import debug from 'debug'
import fs from 'fs-extra'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, groupBy } from '#common'
import { isMain } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('filter-prop-pairings')
debug.enable('filter-prop-pairings')

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../tmp')

const opts = {
  market_odds_max_threshold: 1,
  historical_rate_min_threshold: 0.95,
  opponent_allowed_rate_min_threshold: 0.7,
  joint_historical_rate_min_threshold: 0.95,
  prop_hits_min_threshold: 1,
  highest_payout_min_threshold: 200,
  lowest_payout_min_threshold: -150,
  edge_min_threshold: 0.2,
  total_games_min_threshold: 3,
  exclude_players: ['NH-0110'],
  include_players: [], // ['JJ-1325', 'TH-1875'], //['AB-3150', 'DS-0135'], //['JJ-1325', 'TH-1875'],
  include_teams: [],
  exclude_props: [],
  include_props: [], // ['A.J. Brown 99.5 recv'],
  exclude_nfl_team: ['LV', 'LAR', 'SF', 'TB', 'PIT'],
  opponent_allowed_py_min: null,
  opponent_allowed_ry_min: null,
  opponent_allowed_recy_min: -12,
  opponent_allowed_pc_min: null,
  opponent_allowed_tdp_min: null,
  opponent_allowed_rec_min: null,
  opponent_allowed_ints_min: null,
  opponent_allowed_ra_min: null,
  opponent_allowed_tdrec_min: null,
  opponent_allowed_tdr_min: null,
  opponent_allowed_pa_min: null
}

const opponent_allowed_for_prop_is_negative = ({
  opponent_seasonlog,
  prop_type,
  opts = {}
}) => {
  switch (prop_type) {
    case constants.player_prop_types.GAME_PASSING_YARDS:
    case constants.player_prop_types.GAME_ALT_PASSING_YARDS:
      return opponent_seasonlog.py < (opts.opponent_allowed_py_min || 0)

    case constants.player_prop_types.GAME_RUSHING_YARDS:
    case constants.player_prop_types.GAME_ALT_RUSHING_YARDS:
      return opponent_seasonlog.ry < (opts.opponent_allowed_ry_min || 0)

    case constants.player_prop_types.GAME_RECEIVING_YARDS:
    case constants.player_prop_types.GAME_ALT_RECEIVING_YARDS:
      return opponent_seasonlog.recy < (opts.opponent_allowed_recy_min || 0)

    case constants.player_prop_types.GAME_PASSING_COMPLETIONS:
      return opponent_seasonlog.pc < (opts.opponent_allowed_pc_min || 0)

    case constants.player_prop_types.GAME_PASSING_TOUCHDOWNS:
      return opponent_seasonlog.tdp < (opts.opponent_allowed_tdp_min || 0)

    case constants.player_prop_types.GAME_RECEPTIONS:
      return opponent_seasonlog.rec < (opts.opponent_allowed_rec_min || 0)

    case constants.player_prop_types.GAME_PASSING_INTERCEPTIONS:
      return opponent_seasonlog.ints < (opts.opponent_allowed_ints_min || 0)

    case constants.player_prop_types.GAME_RUSHING_ATTEMPTS:
      return opponent_seasonlog.ra < (opts.opponent_allowed_ra_min || 0)

    case constants.player_prop_types.GAME_SCRIMMAGE_YARDS:
      return opponent_seasonlog.ry + opponent_seasonlog.recy < 0

    case constants.player_prop_types.GAME_RECEIVING_TOUCHDOWNS:
      return opponent_seasonlog.tdrec < (opts.opponent_allowed_tdrec_min || 0)

    case constants.player_prop_types.GAME_RUSHING_TOUCHDOWNS:
      return opponent_seasonlog.tdr < (opts.opponent_allowed_tdr_min || 0)

    case constants.player_prop_types.GAME_PASSING_ATTEMPTS:
      return opponent_seasonlog.pa < (opts.opponent_allowed_pa_min || 0)

    // constants.player_prop_types.GAME_PASSING_LONGEST_COMPLETION,
    // constants.player_prop_types.GAME_LONGEST_RECEPTION,
    case constants.player_prop_types.GAME_RUSHING_RECEIVING_TOUCHDOWNS:
      return opponent_seasonlog.tdr + opponent_seasonlog.tdrec < 1
    // constants.player_prop_types.GAME_LONGEST_RUSH,
  }
}

const filter_prop_pairings = async ({ week = constants.season.week } = {}) => {
  log('options:')
  log(opts)

  const prop_pairing_rows = await db('prop_pairings')
    .where('market_prob', '<=', opts.market_odds_max_threshold)
    .where('hist_rate_soft', '>=', opts.historical_rate_min_threshold)
    .where('opp_allow_rate', '>=', opts.opponent_allowed_rate_min_threshold)
    .where('joint_hist_rate', '>=', opts.joint_historical_rate_min_threshold)
    .where('highest_payout', '>=', opts.highest_payout_min_threshold)
    .where('lowest_payout', '>=', opts.lowest_payout_min_threshold)
    .where('hist_edge_soft', '>=', opts.edge_min_threshold)
    .where('total_games', '>=', opts.total_games_min_threshold)
    .whereNotIn('team', opts.exclude_nfl_team)
    .where('week', week)
    .orderBy('hist_rate_soft', 'DESC')

  const pairing_ids = prop_pairing_rows.map((p) => p.pairing_id)
  const prop_pairing_props = await db('prop_pairing_props')
    .select('props_index.*', 'prop_pairing_props.pairing_id')
    .join('props_index', 'props_index.prop_id', 'prop_pairing_props.prop_id')
    .whereIn('pairing_id', pairing_ids)

  for (const pairing of prop_pairing_rows) {
    pairing.props = prop_pairing_props.filter(
      (prop) => prop.pairing_id === pairing.pairing_id
    )
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
      prop.props.some((p) => opts.exclude_players.includes(p.pid))
    ) {
      return false
    }

    for (const team of opts.include_teams) {
      if (prop.team !== team) {
        return false
      }
    }

    for (const pid of opts.include_players) {
      if (!prop.props.some((p) => p.pid === pid)) {
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

      const opponent_seasonlog = nfl_team_seasonlogs.find(
        (s) =>
          s.stat_key === `${single_prop.pos}_AGAINST_ADJ` &&
          s.tm === single_prop.opp
      )
      if (opponent_seasonlog) {
        const is_negative = opponent_allowed_for_prop_is_negative({
          opponent_seasonlog,
          prop_type: single_prop.prop_type,
          opts
        })
        if (is_negative) {
          return false
        }
      } else {
        log(`missing seasonlog for ${single_prop.opp}`)
      }
    }

    if (opts.include_props.length) {
      const prop_names = prop.props.map((p) => p.name)
      if (!prop_names.some((name) => opts.include_props.includes(name))) {
        return false
      }
    }

    const prop_key = prop.props.map((p) => `${p.pid}_${p.prop_type}`).join('_')
    if (unique_index[prop_key]) {
      unique_index[prop_key] += 1
      return false
    }

    // TODO unique by player / prop type

    if (team_index[prop.team]) {
      team_index[prop.team] += 1
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
          historical_rate_sum: accumulator.historical_rate_sum,
          market_odds_sum: accumulator.market_odds_sum,
          completed: accumulator.completed,
          pending: accumulator.pending + 1,
          payout: accumulator.payout + prop.payout_total,
          risk: accumulator.risk + prop.risk_total
        }
      } else {
        return {
          hits: prop.is_success ? accumulator.hits + 1 : accumulator.hits,
          hist_rate_soft: accumulator.hist_rate_soft + prop.hist_rate_soft,
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
      hist_rate_soft: 0,
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
      summary.hits - summary.market_odds_sum
    ).toFixed(2)}`
  )
  log(
    `Hits Over Historical Expectation: ${(
      summary.hits - summary.historical_rate_sum
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
    log(team)
    log(grouped_by_team[team].map((prop) => prop.name))
  }

  log('Plays By Team')
  const filtered_props_by_team = groupBy(filtered, 'team')
  for (const team of Object.keys(filtered_props_by_team)) {
    log(`${team}: ${filtered_props_by_team[team].length}`)
  }

  log(team_index)
  log(unique_index)
}

const main = async () => {
  let error
  try {
    const week = argv.week
    await filter_prop_pairings({ week })
  } catch (err) {
    error = err
    log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.EXAMPLE,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default filter_prop_pairings
