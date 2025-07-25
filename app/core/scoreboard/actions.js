import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const scoreboard_actions = {
  // websocket events
  SCOREBOARD_REGISTER: 'SCOREBOARD_REGISTER',
  UPDATE_SCOREBOARD_PLAYS: 'UPDATE_SCOREBOARD_PLAYS',

  ...create_api_action_types('GET_SCOREBOARD'),

  SCOREBOARD_SELECT_WEEK: 'SCOREBOARD_SELECT_WEEK',
  select_week: (week) => ({
    type: scoreboard_actions.SCOREBOARD_SELECT_WEEK,
    payload: { week: Number(week) }
  })
}

export const get_scoreboard_actions = create_api_actions('GET_SCOREBOARD')
