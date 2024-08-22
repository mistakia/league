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

const rate_type_handlers = {
  per_game: {
    get_cte_table_name: get_per_game_cte_table_name,
    add_cte: add_per_game_cte,
    join_cte: join_per_game_cte
  },
  per_team_off_play: {
    get_cte_table_name: (params) =>
      get_per_team_play_cte_table_name({ params, team_type: 'off' }),
    add_cte: (args) => add_per_team_play_cte({ ...args, team_type: 'off' }),
    join_cte: join_per_team_play_cte
  },
  per_team_def_play: {
    get_cte_table_name: (params) =>
      get_per_team_play_cte_table_name({ params, team_type: 'def' }),
    add_cte: (args) => add_per_team_play_cte({ ...args, team_type: 'def' }),
    join_cte: join_per_team_play_cte
  },
  per_team_off_pass_play: {
    get_cte_table_name: (params) =>
      get_per_team_play_cte_table_name({
        params,
        play_type: 'PASS',
        team_type: 'off'
      }),
    add_cte: (args) =>
      add_per_team_play_cte({ ...args, play_type: 'PASS', team_type: 'off' }),
    join_cte: join_per_team_play_cte
  },
  per_team_def_pass_play: {
    get_cte_table_name: (params) =>
      get_per_team_play_cte_table_name({
        params,
        play_type: 'PASS',
        team_type: 'def'
      }),
    add_cte: (args) =>
      add_per_team_play_cte({ ...args, play_type: 'PASS', team_type: 'def' }),
    join_cte: join_per_team_play_cte
  },
  per_team_off_rush_play: {
    get_cte_table_name: (params) =>
      get_per_team_play_cte_table_name({
        params,
        play_type: 'RUSH',
        team_type: 'off'
      }),
    add_cte: (args) =>
      add_per_team_play_cte({ ...args, play_type: 'RUSH', team_type: 'off' }),
    join_cte: join_per_team_play_cte
  },
  per_team_def_rush_play: {
    get_cte_table_name: (params) =>
      get_per_team_play_cte_table_name({
        params,
        play_type: 'RUSH',
        team_type: 'def'
      }),
    add_cte: (args) =>
      add_per_team_play_cte({ ...args, play_type: 'RUSH', team_type: 'def' }),
    join_cte: join_per_team_play_cte
  },
  per_team_half: {
    get_cte_table_name: (params) =>
      get_per_team_play_cte_table_name({ params, group_by: 'half' }),
    add_cte: (args) => add_per_team_play_cte({ ...args, group_by: 'half' }),
    join_cte: join_per_team_play_cte
  },
  per_team_quarter: {
    get_cte_table_name: (params) =>
      get_per_team_play_cte_table_name({ params, group_by: 'quarter' }),
    add_cte: (args) => add_per_team_play_cte({ ...args, group_by: 'quarter' }),
    join_cte: join_per_team_play_cte
  },
  per_team_off_drive: {
    get_cte_table_name: (params) =>
      get_per_team_play_cte_table_name({
        params,
        group_by: 'drive',
        team_type: 'off'
      }),
    add_cte: (args) =>
      add_per_team_play_cte({ ...args, group_by: 'drive', team_type: 'off' }),
    join_cte: join_per_team_play_cte
  },
  per_team_def_drive: {
    get_cte_table_name: (params) =>
      get_per_team_play_cte_table_name({
        params,
        group_by: 'drive',
        team_type: 'def'
      }),
    add_cte: (args) =>
      add_per_team_play_cte({ ...args, group_by: 'drive', team_type: 'def' }),
    join_cte: join_per_team_play_cte
  },
  per_team_off_series: {
    get_cte_table_name: (params) =>
      get_per_team_play_cte_table_name({
        params,
        group_by: 'series',
        team_type: 'off'
      }),
    add_cte: (args) =>
      add_per_team_play_cte({ ...args, group_by: 'series', team_type: 'off' }),
    join_cte: join_per_team_play_cte
  },
  per_team_def_series: {
    get_cte_table_name: (params) =>
      get_per_team_play_cte_table_name({
        params,
        group_by: 'series',
        team_type: 'def'
      }),
    add_cte: (args) =>
      add_per_team_play_cte({ ...args, group_by: 'series', team_type: 'def' }),
    join_cte: join_per_team_play_cte
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

export const get_rate_type_cte_table_name = ({ params, rate_type }) => {
  return handle_rate_type_operation('get_cte_table_name', { params, rate_type })
}

export const add_rate_type_cte = (args) => {
  return handle_rate_type_operation('add_cte', args)
}

export const join_rate_type_cte = (args) => {
  return handle_rate_type_operation('join_cte', args)
}
