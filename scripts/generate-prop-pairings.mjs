import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, groupBy } from '#libs-shared'
import { isMain } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-prop-pairings')
debug.enable('generate-prop-pairings')

const get_prop_pairing_id = (props) =>
  props
    .sort((a, b) => a.prop_id - b.prop_id)
    .map((p) => p.prop_id)
    .join('/')

/* const PASS_ALT_LINES = [199.5, 224.5, 249.5, 274.5, 299.5, 324.5, 349.5]
 * const RUSH_RECV_ALT_LINES = [
 *   24.5, 39.5, 49.5, 59.5, 69.5, 79.5, 89.5, 99.5, 109.5, 124.5, 149.5
 * ]
 *  */

/* const generate_player_props = (active_player) => {
 *   const prop_rows = []
 *   const base = {
 *     ...active_player,
 *     o: null,
 *     u: null,
 *     o_am: null,
 *     u_am: null,
 *     source_id: 0,
 *     timestamp: 0,
 *     time_type: 0
 *   }
 *
 *   if (active_player.pos === 'QB') {
 *     for (const line of PASS_ALT_LINES) {
 *       prop_rows.push({
 *         ln: line,
 *         prop_type: constants.player_prop_types.GAME_ALT_PASSING_YARDS,
 *         ...base
 *       })
 *     }
 *   }
 *
 *   if (active_player.pos === 'RB') {
 *     for (const line of RUSH_RECV_ALT_LINES) {
 *       prop_rows.push({
 *         ln: line,
 *         prop_type: constants.player_prop_types.GAME_ALT_RUSHING_YARDS,
 *         ...base
 *       })
 *     }
 *   }
 *
 *   if (active_player.pos === 'WR' || active_player.pos === 'RB') {
 *     for (const line of RUSH_RECV_ALT_LINES) {
 *       prop_rows.push({
 *         ln: line,
 *         prop_type: constants.player_prop_types.GAME_ALT_RECEIVING_YARDS,
 *         ...base
 *       })
 *     }
 *   }
 *
 *   return prop_rows
 * }
 *
 * const generate_props = ({ prop_rows, active_players }) => {
 *   const props_index = {}
 *   for (const prop_row of prop_rows) {
 *     props_index[`${prop_row.pid}_${prop_row.prop_type}_${prop_row.ln}`] = true
 *   }
 *
 *   for (const active_player of active_players) {
 *     const active_player_props = generate_player_props(active_player)
 *     for (const prop_row of active_player_props) {
 *       if (
 *         !props_index[`${prop_row.pid}_${prop_row.prop_type}_${prop_row.ln}`]
 *       ) {
 *         prop_rows.push(prop_row)
 *       }
 *     }
 *   }
 *
 *   return prop_rows
 * }
 *  */

const get_stats_for_props = async ({ props, week }) => {
  let joint_weeks = []
  const weeks_index = {}
  const hits_index_soft = {}
  const hits_index_hard = {}
  const opponent_weeks_index = {}
  const opponent_hits_index = {}
  for (const prop of props) {
    if (prop.hit_weeks_soft)
      prop.hit_weeks_soft.forEach((week) => (hits_index_soft[week] = true))
    if (prop.hit_weeks_hard)
      prop.hit_weeks_hard.forEach((week) => (hits_index_hard[week] = true))
    if (prop.opp_hit_weeks)
      prop.opp_hit_weeks.forEach((week) => (opponent_hits_index[week] = true))
    if (prop.all_weeks)
      prop.all_weeks.forEach((week) => (weeks_index[week] = true))
    if (prop.opp_weeks)
      prop.opp_weeks.forEach((week) => (opponent_weeks_index[week] = true))

    if (joint_weeks.length) {
      joint_weeks = joint_weeks.filter((week) =>
        (prop.all_weeks || []).includes(week)
      )
    } else {
      joint_weeks = prop.all_weeks || []
    }
  }

  const weeks = Object.keys(weeks_index).map((i) => Number(i))
  const hits_soft = Object.keys(hits_index_soft).map((i) => Number(i))
  const hits_hard = Object.keys(hits_index_hard).map((i) => Number(i))
  const joint_week_hits = hits_soft.filter((week) => joint_weeks.includes(week))

  const opponent_weeks = Object.keys(opponent_weeks_index).map((i) => Number(i))
  const opponent_hits = Object.keys(opponent_hits_index).map((i) => Number(i))

  return {
    hist_rate_soft: hits_soft.length / weeks.length || 0,
    hist_rate_hard: hits_hard.length / weeks.length || 0,
    opp_allow_rate: opponent_hits.length / opponent_weeks.length || 0,
    total_games: weeks.length,
    week_last_hit: hits_soft.length ? Math.max(...hits_soft) : null,
    week_first_hit: hits_soft.length ? Math.min(...hits_soft) : null,

    joint_hist_rate: joint_week_hits.length / joint_weeks.length || 0,
    joint_games: joint_weeks.length
    // joint_week_last_hit: Math.max(...joint_week_hits),
    // joint_week_first_hit: Math.min(...joint_week_hits)
  }
}

const format_prop_pairing = ({ props, prop_stats, week, team, source }) => {
  const prop_odds_array = props.map((p) => 1 - p.market_prob)
  const prop_odds_combined = prop_odds_array.reduce((a, b) => a * b, 1)
  const market_prob = 1 - prop_odds_combined

  const props_totals = props.reduce(
    (accumulator, prop) => ({
      risk_total: accumulator.risk_total + (prop.risk || 0),
      payout_total: accumulator.payout_total + (prop.payout || 0)
    }),
    {
      risk_total: 0,
      payout_total: 0
    }
  )

  const prop_names = props.map((p) => p.name)
  const is_pending = props
    .map((p) => p.is_pending)
    .every((pending) => Boolean(pending) === true)
  const is_success = props
    .map((p) => p.is_success)
    .some((success) => Boolean(success) === true)

  const status = is_pending ? 'pending' : is_success ? 'hit' : 'miss'
  const pairing_id = get_prop_pairing_id(props)
  const sorted_payouts = props.map((p) => p.o_am).sort((a, b) => a - b)
  const sum_hist_rate_soft = props.reduce(
    (accumulator, prop) => accumulator + prop.hist_rate_soft,
    0
  )
  const sum_hist_rate_hard = props.reduce(
    (accumulator, prop) => accumulator + prop.hist_rate_hard,
    0
  )
  const pairing = {
    pairing_id,
    source_id: source,
    name: `${prop_names.join(' / ')} (${status})`,
    team,
    week,
    market_prob,
    ...props_totals,
    ...prop_stats,
    size: props.length,
    hist_edge_soft: prop_stats.hist_rate_soft - market_prob,
    hist_edge_hard: prop_stats.hist_rate_hard - market_prob,
    is_pending,
    is_success,
    highest_payout: sorted_payouts[sorted_payouts.length - 1],
    lowest_payout: sorted_payouts[0],
    second_lowest_payout: sorted_payouts[1],
    sum_hist_rate_soft,
    sum_hist_rate_hard
  }

  return {
    pairing,
    pairing_props: props.map((p) => ({ pairing_id, prop_id: p.prop_id }))
  }
}

const generate_prop_pairings = async ({
  week = constants.season.nfl_seas_week,
  year = constants.season.year,
  seas_type = constants.season.nfl_seas_type,
  source = 'FANDUEL'
} = {}) => {
  console.time('generate_prop_pairings')

  const prop_rows = await db('props_index')
    .select('props_index.*')
    .join('nfl_games', 'nfl_games.esbid', 'props_index.esbid')
    .whereNotNull('hist_edge_soft')
    .where('hits_soft', '>', 1)
    .where('o_am', '<', 1000)
    .where('o_am', '>', -350)
    .whereIn('prop_type', [
      constants.player_prop_types.GAME_ALT_PASSING_YARDS,
      constants.player_prop_types.GAME_ALT_RECEIVING_YARDS,
      constants.player_prop_types.GAME_ALT_RUSHING_YARDS,

      constants.player_prop_types.GAME_PASSING_YARDS,
      constants.player_prop_types.GAME_RECEIVING_YARDS,
      constants.player_prop_types.GAME_RUSHING_YARDS,
      constants.player_prop_types.GAME_PASSING_COMPLETIONS,
      constants.player_prop_types.GAME_PASSING_TOUCHDOWNS,
      constants.player_prop_types.GAME_RECEPTIONS,
      constants.player_prop_types.GAME_PASSING_INTERCEPTIONS,
      constants.player_prop_types.GAME_RUSHING_ATTEMPTS,
      constants.player_prop_types.GAME_RUSHING_RECEIVING_YARDS,
      // constants.player_prop_types.GAME_RECEIVING_TOUCHDOWNS,
      // constants.player_prop_types.GAME_RUSHING_TOUCHDOWNS,
      constants.player_prop_types.GAME_PASSING_ATTEMPTS,
      // constants.player_prop_types.GAME_PASSING_LONGEST_COMPLETION,
      // constants.player_prop_types.GAME_LONGEST_RECEPTION,
      // constants.player_prop_types.GAME_RUSHING_RECEIVING_TOUCHDOWNS,
      // constants.player_prop_types.GAME_LONGEST_RUSH,
      constants.player_prop_types.GAME_PASSING_RUSHING_YARDS,
      constants.player_prop_types.GAME_ALT_PASSING_TOUCHDOWNS,
      constants.player_prop_types.GAME_ALT_PASSING_COMPLETIONS,
      constants.player_prop_types.GAME_ALT_RUSHING_ATTEMPTS,
      constants.player_prop_types.GAME_ALT_RECEPTIONS
    ])
    .where('time_type', 'CLOSE')
    .where('source_id', source)
    // .whereNot('source_id', constants.sources.PRIZEPICKS)
    .where('nfl_games.week', week)
    .where('nfl_games.year', year)
    .where('nfl_games.seas_type', seas_type)

  log(`loaded ${prop_rows.length} props`)

  /* const prop_pid_query = await db('props_index')
   *   .select('pid')
   *   .where({ year: constants.season.year, week: week - 1 })
   *   .groupBy('pid')
   * const prop_pids = prop_pid_query.map((p) => p.pid)

   * const active_players = await db('player')
   *   .select('fname', 'lname', 'pid', 'current_nfl_team', 'pos')
   *   .whereIn('pos', ['QB', 'RB', 'WR', 'TE'])
   *   .whereNot('current_nfl_team', 'INA')
   *   .where('nfl_status', constants.player_nfl_status.ACTIVE)
   *   .whereIn('pid', prop_pids)

   * log(`loaded ${active_players.length} active players`)
   */
  const all_props = prop_rows // generate_props({ prop_rows, active_players })

  log(`generated ${all_props.length} props`)

  const prop_pairing_inserts = []
  const prop_pairing_props_inserts = []

  const props_by_team = groupBy(all_props, 'team')
  for (const tm of Object.keys(props_by_team)) {
    const tm_props = props_by_team[tm]
    const props_by_pid = groupBy(tm_props, 'pid')

    const pids = Object.keys(props_by_pid)
    for (let i = 0; i < pids.length; i++) {
      const pid_a = pids[i]

      for (const prop_a of props_by_pid[pid_a]) {
        const props = [prop_a]

        const prop_stats = await get_stats_for_props({
          props,
          week
        })

        const prop_group_data = format_prop_pairing({
          team: tm,
          prop_stats,
          props,
          week,
          source
        })

        prop_pairing_inserts.push(prop_group_data.pairing)
        prop_group_data.pairing_props.forEach((i) =>
          prop_pairing_props_inserts.push(i)
        )
      }

      for (let j = i + 1; j < pids.length; j++) {
        const pid_b = pids[j]

        for (const prop_a of props_by_pid[pid_a]) {
          for (const prop_b of props_by_pid[pid_b]) {
            const props = [prop_a, prop_b]

            const prop_stats = await get_stats_for_props({
              props,
              week
            })

            const prop_group_data = format_prop_pairing({
              team: tm,
              prop_stats,
              props,
              week,
              source
            })

            prop_pairing_inserts.push(prop_group_data.pairing)
            prop_group_data.pairing_props.forEach((i) =>
              prop_pairing_props_inserts.push(i)
            )
          }
        }

        if (pids.length < 3) continue

        for (let k = j + 1; k < pids.length; k++) {
          const pid_c = pids[k]

          for (const prop_a of props_by_pid[pid_a]) {
            for (const prop_b of props_by_pid[pid_b]) {
              for (const prop_c of props_by_pid[pid_c]) {
                const props = [prop_a, prop_b, prop_c]

                const prop_stats = await get_stats_for_props({
                  props,
                  week
                })

                const prop_group_data = format_prop_pairing({
                  team: tm,
                  prop_stats,
                  props,
                  week,
                  source
                })

                prop_pairing_inserts.push(prop_group_data.pairing)
                prop_group_data.pairing_props.forEach((i) =>
                  prop_pairing_props_inserts.push(i)
                )
              }
            }
          }
        }
      }
    }
  }

  log(`generated ${prop_pairing_inserts.length} prop pairings`)

  if (prop_pairing_inserts.length) {
    const chunk_size = 10000
    for (let i = 0; i < prop_pairing_inserts.length; i += chunk_size) {
      const chunk = prop_pairing_inserts.slice(i, i + chunk_size)
      await db('prop_pairings').insert(chunk).onConflict().merge()
    }

    if (prop_pairing_props_inserts.length) {
      for (let i = 0; i < prop_pairing_props_inserts.length; i += chunk_size) {
        const chunk = prop_pairing_props_inserts.slice(i, i + chunk_size)
        await db('prop_pairing_props').insert(chunk).onConflict().merge()
      }
    }

    log(`inserted ${prop_pairing_inserts.length} prop pairings`)
  }

  console.timeEnd('generate_prop_pairings')
}

const main = async () => {
  let error
  try {
    const week = argv.week
    const year = argv.year
    const seas_type = argv.seas_type
    const source = argv.source
    await generate_prop_pairings({ week, year, seas_type, source })
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

export default generate_prop_pairings
