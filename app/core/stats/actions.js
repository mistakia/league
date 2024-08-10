import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const statActions = {
  ...create_api_action_types('GET_CHARTED_PLAYS'),

  SET_TEAM_STATS_PERCENTILES: 'SET_TEAM_STATS_PERCENTILES',
  setTeamStatsPercentiles: (percentiles) => ({
    type: statActions.SET_TEAM_STATS_PERCENTILES,
    payload: {
      percentiles
    }
  }),

  UPDATE_QUALIFIER: 'UPDATE_QUALIFIER',
  updateQualifier: ({ qualifier, value }) => ({
    type: statActions.UPDATE_QUALIFIER,
    payload: {
      qualifier,
      value
    }
  }),

  FILTER_STATS: 'FILTER_STATS',
  filter: ({ type, values }) => ({
    type: statActions.FILTER_STATS,
    payload: {
      type,
      values
    }
  }),

  FILTER_STATS_YARDLINE: 'FILTER_STATS_YARDLINE',
  filter_yardline: ({ yardline_start, yardline_end }) => ({
    type: statActions.FILTER_STATS_YARDLINE,
    payload: {
      yardline_start,
      yardline_end
    }
  })
}

export const getChartedPlaysActions = create_api_actions('GET_CHARTED_PLAYS')
