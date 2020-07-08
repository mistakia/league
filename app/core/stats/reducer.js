import { Record, List } from 'immutable'

import { statActions } from './actions'
import { playerActions } from '@core/players'
import { constants } from '@common'

const initialState = new Record({
  plays: new List(),
  view: 'passing',
  passing: 'advanced',
  years: new List([constants.week ? constants.year : (constants.year - 1)]),
  weeks: new List(constants.nflWeeks),
  days: new List(constants.days),
  quarters: new List(constants.quarters),
  downs: new List(constants.downs),
  overall: null
})

export function statsReducer (state = initialState(), { payload, type }) {
  switch (type) {
    case playerActions.SET_PLAYER_STATS:
      return state.merge({ overall: payload.overall })

    case statActions.FILTER_STATS:
      return state.merge({ [payload.type]: new List(payload.value) })

    case statActions.SET_STAT_VIEW:
      return state.merge({
        view: payload.view
      })

    case statActions.SET_STAT_PASSING_VIEW:
      return state.merge({
        passing: payload.view
      })

    case statActions.GET_PLAYS_FULFILLED:
      return state.merge({
        plays: new List(payload.data)
      })

    default:
      return state
  }
}
