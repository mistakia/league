import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import * as oddslib from 'oddslib'

import db from '#db'
import { constants, groupBy } from '#libs-shared'
import { player_prop_types } from '#libs-shared/bookmaker-constants.mjs'
import { is_main } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-prop-pairings')
debug.enable('generate-prop-pairings')

const get_prop_pairing_id = (props) =>
  props
    .sort((a, b) => {
      // Sort by source_market_id first, then by source_selection_id
      if (a.source_market_id !== b.source_market_id) {
        return a.source_market_id.localeCompare(b.source_market_id)
      }
      return a.source_selection_id - b.source_selection_id
    })
    .map((p) => `${p.source_market_id}:${p.source_selection_id}`)
    .join('/')

const extract_week = (week_string) => {
  const parts = week_string.split('/')
  return parseInt(parts[parts.length - 1], 10)
}

const get_stats_for_props = async ({ props, week }) => {
  const periods = ['last_five', 'last_ten', 'current_season', 'last_season']
  const stats = {}

  for (const period of periods) {
    let joint_weeks = []
    const weeks_index = {}
    const hits_index_soft = {}
    const hits_index_hard = {}
    const opponent_weeks_index = {}
    const opponent_hits_index = {}

    for (const prop of props) {
      if (prop[`${period}_hit_weeks_soft`])
        prop[`${period}_hit_weeks_soft`].forEach(
          (week) => (hits_index_soft[week] = true)
        )
      if (prop[`${period}_hit_weeks_hard`])
        prop[`${period}_hit_weeks_hard`].forEach(
          (week) => (hits_index_hard[week] = true)
        )
      if (prop[`${period}_opp_hit_weeks`])
        prop[`${period}_opp_hit_weeks`].forEach(
          (week) => (opponent_hits_index[week] = true)
        )

      if (prop[`${period}_weeks_played`]) {
        prop[`${period}_weeks_played`].forEach(
          (week) => (weeks_index[week] = true)
        )
      }

      if (prop[`${period}_opp_weeks_played`]) {
        prop[`${period}_opp_weeks_played`].forEach(
          (week) => (opponent_weeks_index[week] = true)
        )
      }

      if (joint_weeks.length) {
        joint_weeks = joint_weeks.filter((week) =>
          prop[`${period}_weeks_played`].includes(week)
        )
      } else {
        joint_weeks = prop[`${period}_weeks_played`] || []
      }
    }

    const weeks = Object.keys(weeks_index)
    const hits_soft = Object.keys(hits_index_soft)
    const hits_hard = Object.keys(hits_index_hard)
    const joint_week_soft_hits = hits_soft.filter((week) =>
      joint_weeks.includes(week)
    )

    const opponent_weeks = Object.keys(opponent_weeks_index)
    const opponent_hits = Object.keys(opponent_hits_index)

    stats[period] = {
      hist_rate_soft: hits_soft.length / weeks.length || 0,
      hist_rate_hard: hits_hard.length / weeks.length || 0,
      opp_allow_rate: opponent_hits.length / opponent_weeks.length || 0,
      total_games: weeks.length,
      week_last_hit: hits_soft.length
        ? Math.max(...hits_soft.map(extract_week))
        : null,
      week_first_hit: hits_soft.length
        ? Math.min(...hits_soft.map(extract_week))
        : null,
      joint_hist_rate_soft:
        joint_week_soft_hits.length / joint_weeks.length || 0,
      joint_games: joint_weeks.length
    }
  }

  return stats
}

const format_prop_pairing = ({ props, prop_stats, week, team, source }) => {
  const prop_odds_array = props.map((p) => {
    const implied_probability = oddslib
      .from('moneyline', p.odds_american)
      .to('impliedProbability')
    return 1 - implied_probability
  })
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
  // TODO fix
  // const is_pending = props
  //   .map((p) => p.is_pending)
  //   .every((pending) => Boolean(pending) === true)
  // const is_success = props
  //   .map((p) => p.is_success)
  //   .some((success) => Boolean(success) === true)
  // const status = is_pending ? 'pending' : is_success ? 'hit' : 'miss'
  const status = 'pending'
  const pairing_id = get_prop_pairing_id(props)
  const sorted_payouts = props.map((p) => p.odds_american).sort((a, b) => a - b)
  const sum_hist_rate_soft = props.reduce(
    (accumulator, prop) => accumulator + prop.current_season_hit_rate_soft,
    0
  )
  const sum_hist_rate_hard = props.reduce(
    (accumulator, prop) => accumulator + prop.current_season_hit_rate_hard,
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
    current_season_hist_rate_soft: prop_stats.current_season.hist_rate_soft,
    current_season_hist_rate_hard: prop_stats.current_season.hist_rate_hard,
    current_season_opp_allow_rate: prop_stats.current_season.opp_allow_rate,
    current_season_total_games: prop_stats.current_season.total_games,
    current_season_week_last_hit: prop_stats.current_season.week_last_hit,
    current_season_week_first_hit: prop_stats.current_season.week_first_hit,
    current_season_joint_hist_rate_soft:
      prop_stats.current_season.joint_hist_rate_soft,
    current_season_joint_games: prop_stats.current_season.joint_games,
    size: props.length,
    current_season_hist_edge_soft:
      prop_stats.current_season.hist_rate_soft - market_prob,
    current_season_hist_edge_hard:
      prop_stats.current_season.hist_rate_hard - market_prob,
    // TODO fix
    // is_pending,
    // is_success,
    highest_payout: sorted_payouts[sorted_payouts.length - 1],
    lowest_payout: sorted_payouts[0],
    second_lowest_payout: sorted_payouts[1],
    current_season_sum_hist_rate_soft: sum_hist_rate_soft,
    current_season_sum_hist_rate_hard: sum_hist_rate_hard
  }

  // Add stats for other periods
  for (const period of ['last_five', 'last_ten', 'last_season']) {
    pairing[`${period}_hist_rate_soft`] = prop_stats[period].hist_rate_soft
    pairing[`${period}_hist_rate_hard`] = prop_stats[period].hist_rate_hard
    pairing[`${period}_joint_hist_rate_soft`] =
      prop_stats[period].joint_hist_rate_soft
    pairing[`${period}_hist_edge_soft`] =
      prop_stats[period].hist_rate_soft - market_prob
    pairing[`${period}_hist_edge_hard`] =
      prop_stats[period].hist_rate_hard - market_prob
  }

  return {
    pairing,
    pairing_props: props.map((p) => ({
      pairing_id,
      source_market_id: p.source_market_id,
      source_selection_id: p.source_selection_id
    }))
  }
}

const generate_prop_pairings = async ({
  week = constants.season.nfl_seas_week,
  year = constants.season.year,
  seas_type = constants.season.nfl_seas_type,
  source = 'FANDUEL',
  dry_run = false
} = {}) => {
  console.time('generate_prop_pairings')

  const prop_rows = await db('current_week_prop_market_selections_index')
    .select(
      'current_week_prop_market_selections_index.*',
      'prop_market_selections_index.*',
      'nfl_games.year',
      'nfl_games.week',
      'nfl_games.seas_type'
    )
    .join('prop_market_selections_index', function () {
      this.on(
        'prop_market_selections_index.source_id',
        '=',
        'current_week_prop_market_selections_index.source_id'
      )
        .andOn(
          'prop_market_selections_index.source_market_id',
          '=',
          'current_week_prop_market_selections_index.source_market_id'
        )
        .andOn(
          'prop_market_selections_index.source_selection_id',
          '=',
          'current_week_prop_market_selections_index.source_selection_id'
        )
    })
    .join(
      'nfl_games',
      'nfl_games.esbid',
      'current_week_prop_market_selections_index.esbid'
    )
    .whereNotNull('current_season_hits_soft')
    .where('current_season_hits_soft', '>', 1)
    .where('prop_market_selections_index.odds_american', '<', 1000)
    .where('prop_market_selections_index.odds_american', '>', -350)
    .whereIn('current_week_prop_market_selections_index.market_type', [
      player_prop_types.GAME_ALT_PASSING_YARDS,
      player_prop_types.GAME_ALT_RECEIVING_YARDS,
      player_prop_types.GAME_ALT_RUSHING_YARDS,

      player_prop_types.GAME_PASSING_YARDS,
      player_prop_types.GAME_RECEIVING_YARDS,
      player_prop_types.GAME_RUSHING_YARDS,
      player_prop_types.GAME_PASSING_COMPLETIONS,
      player_prop_types.GAME_PASSING_TOUCHDOWNS,
      player_prop_types.GAME_RECEPTIONS,
      player_prop_types.GAME_PASSING_INTERCEPTIONS,
      player_prop_types.GAME_RUSHING_ATTEMPTS,
      player_prop_types.GAME_RUSHING_RECEIVING_YARDS,
      // player_prop_types.GAME_RECEIVING_TOUCHDOWNS,
      // player_prop_types.GAME_RUSHING_TOUCHDOWNS,
      player_prop_types.GAME_PASSING_ATTEMPTS,
      // player_prop_types.GAME_PASSING_LONGEST_COMPLETION,
      // player_prop_types.GAME_LONGEST_RECEPTION,
      // player_prop_types.GAME_RUSHING_RECEIVING_TOUCHDOWNS,
      // player_prop_types.GAME_LONGEST_RUSH,
      player_prop_types.GAME_PASSING_RUSHING_YARDS,
      player_prop_types.GAME_ALT_PASSING_TOUCHDOWNS,
      player_prop_types.GAME_ALT_PASSING_COMPLETIONS,
      player_prop_types.GAME_ALT_RUSHING_ATTEMPTS,
      player_prop_types.GAME_ALT_RECEPTIONS
    ])
    .where('prop_market_selections_index.time_type', 'CLOSE')
    .where('prop_market_selections_index.source_id', source)
    .where('nfl_games.week', week)
    .where('nfl_games.year', year)
    .where('nfl_games.seas_type', seas_type)

  log(`loaded ${prop_rows.length} props`)

  const all_props = prop_rows

  log(`generated ${all_props.length} props`)

  const prop_pairing_inserts = []
  const prop_pairing_props_inserts = []

  const props_by_team = groupBy(all_props, 'team')
  for (const tm of Object.keys(props_by_team)) {
    const tm_props = props_by_team[tm]
    const props_by_pid = groupBy(tm_props, 'selection_pid')

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

  if (dry_run) {
    // Log props with the same pairing_id
    const pairing_id_counts = {}
    prop_pairing_inserts.forEach((pairing) => {
      if (pairing_id_counts[pairing.pairing_id]) {
        pairing_id_counts[pairing.pairing_id]++
      } else {
        pairing_id_counts[pairing.pairing_id] = 1
      }
    })

    const duplicate_pairings = Object.entries(pairing_id_counts).filter(
      ([_, count]) => count > 1
    )

    if (duplicate_pairings.length > 0) {
      log(`Found ${duplicate_pairings.length} pairing_ids with multiple props:`)
      duplicate_pairings.forEach(([pairing_id, count]) => {
        log(`pairing_id: ${pairing_id}, count: ${count}`)
        const duplicates = prop_pairing_inserts.filter(
          (p) => p.pairing_id === pairing_id
        )
        log(duplicates)
      })
    } else {
      log('No duplicate pairing_ids found.')
    }
    log(prop_pairing_inserts[0])
    return
  }

  if (prop_pairing_inserts.length) {
    const chunk_size = 1000
    for (let i = 0; i < prop_pairing_inserts.length; i += chunk_size) {
      const chunk = prop_pairing_inserts.slice(i, i + chunk_size)
      await db('prop_pairings').insert(chunk).onConflict('pairing_id').merge()
    }

    if (prop_pairing_props_inserts.length) {
      for (let i = 0; i < prop_pairing_props_inserts.length; i += chunk_size) {
        const chunk = prop_pairing_props_inserts.slice(i, i + chunk_size)
        await db('prop_pairing_props')
          .insert(chunk)
          .onConflict(['pairing_id', 'source_market_id', 'source_selection_id'])
          .merge()
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
    const dry_run = argv.dry
    await generate_prop_pairings({ week, year, seas_type, source, dry_run })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default generate_prop_pairings
