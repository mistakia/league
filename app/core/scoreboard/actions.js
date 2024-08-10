import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const scoreboardActions = {
  // websocket events
  SCOREBOARD_REGISTER: 'SCOREBOARD_REGISTER',
  UPDATE_SCOREBOARD_PLAYS: 'UPDATE_SCOREBOARD_PLAYS',

  ...create_api_action_types('GET_SCOREBOARD'),

  SCOREBOARD_SELECT_WEEK: 'SCOREBOARD_SELECT_WEEK',
  selectWeek: (week) => ({
    type: scoreboardActions.SCOREBOARD_SELECT_WEEK,
    payload: {
      week: Number(week)
    }
  })
}

export const getScoreboardActions = create_api_actions('GET_SCOREBOARD')
