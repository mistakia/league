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
import { isMain } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('filter-prop-pairings')
debug.enable('filter-prop-pairings')

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../tmp')

const default_options = {
  market_odds_max_threshold: 1,
  historical_rate_min_threshold: 1,
  opponent_allowed_rate_min_threshold: 1,
  joint_historical_rate_min_threshold: 1,
  prop_hits_min_threshold: 1,
  pairing_size_max_threshold: 3,
  highest_payout_min_threshold: 100,
  lowest_payout_min_threshold: 100,
  risk_total_max_threshold: 10,
  edge_min_threshold: 0,
  total_games_min_threshold: 3,
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

    case constants.player_prop_types.GAME_ALT_PASSING_COMPLETIONS:
    case constants.player_prop_types.GAME_PASSING_COMPLETIONS:
      return opponent_seasonlog.pc < (opts.opponent_allowed_pc_min || 0)

    case constants.player_prop_types.GAME_PASSING_TOUCHDOWNS:
      return opponent_seasonlog.tdp < (opts.opponent_allowed_tdp_min || 0)

    case constants.player_prop_types.GAME_RECEPTIONS:
      return opponent_seasonlog.rec < (opts.opponent_allowed_rec_min || 0)

    case constants.player_prop_types.GAME_PASSING_INTERCEPTIONS:
      return opponent_seasonlog.ints < (opts.opponent_allowed_ints_min || 0)

    case constants.player_prop_types.GAME_ALT_RUSHING_ATTEMPTS:
    case constants.player_prop_types.GAME_RUSHING_ATTEMPTS:
      return opponent_seasonlog.ra < (opts.opponent_allowed_ra_min || 0)

    case constants.player_prop_types.GAME_RUSHING_RECEIVING_YARDS:
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

const filter_prop_pairings = async ({
  week = constants.season.nfl_seas_week,
  year = constants.season.year,
  seas_type = constants.season.nfl_seas_type,
  source = 'FANDUEL'
} = {}) => {
  const opts = merge(default_options, config.filter_prop_pairings_options || {})
  log('options:')
  log(opts)

  const prop_pairing_query = db('prop_pairings')
    .where('source_id', source)
    .where('week', week)
    .orderBy('hist_rate_soft', 'DESC')
    .orderBy('hist_edge_soft', 'DESC')
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
    opts.historical_rate_min_threshold !== null &&
    opts.historical_rate_min_threshold !== undefined
  ) {
    prop_pairing_query.where(
      'hist_rate_soft',
      '>=',
      opts.historical_rate_min_threshold
    )
  }
  if (
    opts.opponent_allowed_rate_min_threshold !== null &&
    opts.opponent_allowed_rate_min_threshold !== undefined
  ) {
    prop_pairing_query.where(
      'opp_allow_rate',
      '>=',
      opts.opponent_allowed_rate_min_threshold
    )
  }
  if (
    opts.joint_historical_rate_min_threshold !== null &&
    opts.joint_historical_rate_min_threshold !== undefined
  ) {
    prop_pairing_query.where(
      'joint_hist_rate',
      '>=',
      opts.joint_historical_rate_min_threshold
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
  if (opts.hist_edge_soft !== null && opts.hist_edge_soft !== undefined) {
    prop_pairing_query.where('hist_edge_soft', '>=', opts.hist_edge_soft)
  }
  if (
    opts.total_games_min_threshold !== null &&
    opts.total_games_min_threshold !== undefined
  ) {
    prop_pairing_query.where(
      'total_games',
      '>=',
      opts.total_games_min_threshold
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

  log(prop_pairing_query.toString())
  const prop_pairing_rows = await prop_pairing_query

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
    const p = new Table({
      title: `${team} plays`,
      columns: [
        { name: 'pairing', alignment: 'left' },
        { name: 'hit_rate', alignment: 'right' },
        { name: 'edge', alignment: 'right' },
        { name: 'high', alignment: 'right' },
        { name: 'low', alignment: 'right' },
        { name: 'status', alignment: 'right' }
      ]
    })
    grouped_by_team[team].forEach((prop) => {
      const status = prop.is_pending
        ? 'pending'
        : prop.is_success
        ? 'hit'
        : 'miss'
      const prop_names = prop.props.map(
        (p) => `${p.name} [${Math.round(p.hist_rate_soft * 100)}% / ${p.o_am}]`
      )

      p.addRow({
        pairing: `${prop_names.join(' / ')}`,
        hit_rate: `${Math.round(prop.hist_rate_soft * 100)}%`,
        edge: `${(prop.hist_edge_soft * 100).toFixed(1)}%`,
        high: prop.highest_payout,
        low: prop.lowest_payout,
        status
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
    await filter_prop_pairings({ week, source })
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
