import { Record, List, Map } from 'immutable'

import { statActions } from './actions'
import { playerActions } from '@core/players'
import { constants } from '@libs-shared'

const initialState = new Record({
  isPending: false,
  plays: new List(),
  teamStats: new List(),
  qualifiers: new Map(constants.qualifiers),
  years: new List([constants.week ? constants.year : constants.year - 1]),
  weeks: new List(constants.nflWeeks),
  days: new List(constants.days),
  quarters: new List(constants.quarters),
  downs: new List(constants.downs),
  yardline_start: 0,
  yardline_end: 100,
  teamStatsPercentiles: new Record({})
})

export function statsReducer(state = initialState(), { payload, type }) {
  switch (type) {
    case statActions.UPDATE_QUALIFIER:
      return state.setIn(
        ['qualifiers', payload.qualifier, 'value'],
        payload.value
      )

    case statActions.GET_CHARTED_PLAYS_PENDING:
      return state.merge({ isPending: true })

    case statActions.GET_CHARTED_PLAYS_FAILED:
      return state.merge({ isPending: false })

    case playerActions.SET_PLAYER_STATS:
      return state.merge({
        isPending: false
      })

    case statActions.SET_TEAM_STATS_PERCENTILES:
      return state.merge({ teamStatsPercentiles: payload.percentiles })

    case statActions.FILTER_STATS:
      return state.merge({ [payload.type]: new List(payload.values) })

    case statActions.FILTER_STATS_YARDLINE:
      return state.merge({ ...payload })

    case statActions.GET_CHARTED_PLAYS_FULFILLED:
      return state.merge({
        plays: new List(payload.data)
      })

    case statActions.GET_TEAM_STATS_FULFILLED:
      return state.merge({
        teamStats: new List(payload.data)
      })

    default:
      return state
  }
}
