import {
  get_per_game_cte_table_name,
  add_per_game_cte,
  join_per_game_cte
} from './rate-type-per-game.mjs'

import {
  get_per_team_play_cte_table_name,
  add_per_team_play_cte,
  join_per_team_play_cte
} from './rate-type-per-team-play.mjs'

import {
  get_per_player_cte_table_name,
  add_per_player_cte,
  join_per_player_cte
} from './rate-type-per-player.mjs'

import {
  get_per_player_play_cte_table_name,
  add_per_player_play_cte,
  join_per_player_play_cte
} from './rate-type-per-player-play.mjs'

const rate_type_handlers = {
  per_game: {
    get_cte_table_name: get_per_game_cte_table_name,
    add_cte: add_per_game_cte,
    join_cte: join_per_game_cte
  },
  per_team_play: {
    get_cte_table_name: (args) => get_per_team_play_cte_table_name({ ...args }),
    add_cte: (args) => add_per_team_play_cte({ ...args }),
    join_cte: join_per_team_play_cte
  },
  per_team_pass_play: {
    get_cte_table_name: (args) =>
      get_per_team_play_cte_table_name({
        ...args,
        play_type: 'PASS'
      }),
    add_cte: (args) => add_per_team_play_cte({ ...args, play_type: 'PASS' }),
    join_cte: join_per_team_play_cte
  },
  per_team_rush_play: {
    get_cte_table_name: (args) =>
      get_per_team_play_cte_table_name({
        ...args,
        play_type: 'RUSH'
      }),
    add_cte: (args) => add_per_team_play_cte({ ...args, play_type: 'RUSH' }),
    join_cte: join_per_team_play_cte
  },
  per_team_half: {
    get_cte_table_name: (args) =>
      get_per_team_play_cte_table_name({ ...args, group_by: 'half' }),
    add_cte: (args) => add_per_team_play_cte({ ...args, group_by: 'half' }),
    join_cte: join_per_team_play_cte
  },
  per_team_quarter: {
    get_cte_table_name: (args) =>
      get_per_team_play_cte_table_name({ ...args, group_by: 'quarter' }),
    add_cte: (args) => add_per_team_play_cte({ ...args, group_by: 'quarter' }),
    join_cte: join_per_team_play_cte
  },
  per_team_drive: {
    get_cte_table_name: (args) =>
      get_per_team_play_cte_table_name({
        ...args,
        group_by: 'drive'
      }),
    add_cte: (args) => add_per_team_play_cte({ ...args, group_by: 'drive' }),
    join_cte: join_per_team_play_cte
  },
  per_team_series: {
    get_cte_table_name: (args) =>
      get_per_team_play_cte_table_name({
        ...args,
        group_by: 'series'
      }),
    add_cte: (args) => add_per_team_play_cte({ ...args, group_by: 'series' }),
    join_cte: join_per_team_play_cte
  },
  per_player_rush_attempt: {
    get_cte_table_name: (args) =>
      get_per_player_cte_table_name({ ...args, stat_type: 'rush_attempt' }),
    add_cte: (args) =>
      add_per_player_cte({ ...args, stat_type: 'rush_attempt' }),
    join_cte: join_per_player_cte
  },
  per_player_pass_attempt: {
    get_cte_table_name: (args) =>
      get_per_player_cte_table_name({ ...args, stat_type: 'pass_attempt' }),
    add_cte: (args) =>
      add_per_player_cte({ ...args, stat_type: 'pass_attempt' }),
    join_cte: join_per_player_cte
  },
  per_player_target: {
    get_cte_table_name: (args) =>
      get_per_player_cte_table_name({ ...args, stat_type: 'target' }),
    add_cte: (args) => add_per_player_cte({ ...args, stat_type: 'target' }),
    join_cte: join_per_player_cte
  },
  per_player_catchable_target: {
    get_cte_table_name: (args) =>
      get_per_player_cte_table_name({
        ...args,
        stat_type: 'target',
        rate_type_params: { catchable_ball: true }
      }),
    add_cte: (args) =>
      add_per_player_cte({
        ...args,
        stat_type: 'target',
        rate_type_params: { catchable_ball: true }
      }),
    join_cte: join_per_player_cte
  },
  per_player_deep_target: {
    get_cte_table_name: (args) =>
      get_per_player_cte_table_name({
        ...args,
        stat_type: 'target',
        rate_type_params: { dot: [20, 99] }
      }),
    add_cte: (args) =>
      add_per_player_cte({
        ...args,
        stat_type: 'target',
        rate_type_params: { dot: [20, 99] }
      }),
    join_cte: join_per_player_cte
  },
  per_player_catchable_deep_target: {
    get_cte_table_name: (args) =>
      get_per_player_cte_table_name({
        ...args,
        stat_type: 'target',
        rate_type_params: { dot: [20, 99], catchable_ball: true }
      }),
    add_cte: (args) =>
      add_per_player_cte({
        ...args,
        stat_type: 'target',
        rate_type_params: { dot: [20, 99], catchable_ball: true }
      }),
    join_cte: join_per_player_cte
  },
  per_player_reception: {
    get_cte_table_name: (args) =>
      get_per_player_cte_table_name({ ...args, stat_type: 'reception' }),
    add_cte: (args) => add_per_player_cte({ ...args, stat_type: 'reception' }),
    join_cte: join_per_player_cte
  },
  per_player_play: {
    get_cte_table_name: (args) =>
      get_per_player_play_cte_table_name({ ...args }),
    add_cte: (args) => add_per_player_play_cte({ ...args }),
    join_cte: join_per_player_play_cte
  },
  per_player_pass_play: {
    get_cte_table_name: (args) =>
      get_per_player_play_cte_table_name({
        ...args,
        play_type: 'PASS'
      }),
    add_cte: (args) => add_per_player_play_cte({ ...args, play_type: 'PASS' }),
    join_cte: join_per_player_play_cte
  },
  per_player_rush_play: {
    get_cte_table_name: (args) =>
      get_per_player_play_cte_table_name({
        ...args,
        play_type: 'RUSH'
      }),
    add_cte: (args) => add_per_player_play_cte({ ...args, play_type: 'RUSH' }),
    join_cte: join_per_player_play_cte
  }
}

const handle_rate_type_operation = (operation, args) => {
  const { rate_type } = args
  const handler = rate_type_handlers[rate_type]
  if (handler) {
    return handler[operation](args)
  } else {
    console.log(`Ignored invalid rate_type: ${rate_type}`)
  }
}

export const get_rate_type_cte_table_name = (args) => {
  return handle_rate_type_operation('get_cte_table_name', args)
}

export const add_rate_type_cte = (args) => {
  return handle_rate_type_operation('add_cte', args)
}

export const join_rate_type_cte = (args) => {
  return handle_rate_type_operation('join_cte', args)
}
