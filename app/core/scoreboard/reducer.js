import { Map } from 'immutable'
import moment from 'moment'

import { playActions } from '@core/plays'
import { scoreboardActions } from './actions'
import { constants } from '@common'

const initialState = new Map({
  isLoaded: false,
  week: Math.max(moment().day() === 2 ? (constants.season.week - 1) : constants.season.week, 1)
})

export function scoreboardReducer (state = initialState, { payload, type }) {
  switch (type) {
    case scoreboardActions.UPDATE_SCOREBOARD_PLAYS:
    case scoreboardActions.GET_SCOREBOARD_FULFILLED:
    case playActions.GET_PLAYSTATS_FULFILLED:
      return state.set('isLoaded', true)

    case scoreboardActions.SCOREBOARD_SELECT_WEEK:
      return state.merge({
        week: payload.week
      })

    default:
      return state
  }
}
