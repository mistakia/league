import { Map } from 'immutable'
import dayjs from 'dayjs'

import { playActions } from '@core/plays'
import { scoreboardActions } from './actions'
import { constants } from '@common'

const current_week = Math.min(constants.week, constants.season.finalWeek)
const initial_week = Math.max(
  dayjs().day() === 2 ? current_week - 1 : current_week,
  1
)

const initialState = new Map({
  isLoaded: false,
  week: initial_week
})

export function scoreboardReducer(state = initialState, { payload, type }) {
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
