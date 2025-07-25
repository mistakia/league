import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const stat_actions = {
  ...create_api_action_types('GET_CHARTED_PLAYS'),

  INIT_CHARTED_PLAYS: 'INIT_CHARTED_PLAYS',
  init_charted_plays: () => ({
    type: stat_actions.INIT_CHARTED_PLAYS
  }),

  SET_TEAM_STATS_PERCENTILES: 'SET_TEAM_STATS_PERCENTILES',
  set_team_stats_percentiles: (percentiles) => ({
    type: stat_actions.SET_TEAM_STATS_PERCENTILES,
    payload: {
      percentiles
    }
  }),

  UPDATE_QUALIFIER: 'UPDATE_QUALIFIER',
  update_qualifier: ({ qualifier, value }) => ({
    type: stat_actions.UPDATE_QUALIFIER,
    payload: {
      qualifier,
      value
    }
  }),

  FILTER_STATS: 'FILTER_STATS',
  filter: ({ type, values }) => ({
    type: stat_actions.FILTER_STATS,
    payload: {
      type,
      values
    }
  }),

  FILTER_STATS_YARDLINE: 'FILTER_STATS_YARDLINE',
  filter_yardline: ({ yardline_start, yardline_end }) => ({
    type: stat_actions.FILTER_STATS_YARDLINE,
    payload: {
      yardline_start,
      yardline_end
    }
  })
}

export const get_charted_plays_actions = create_api_actions('GET_CHARTED_PLAYS')
