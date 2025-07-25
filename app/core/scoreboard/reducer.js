import { Map } from 'immutable'
import dayjs from 'dayjs'

import { play_actions } from '@core/plays'
import { scoreboard_actions } from './actions'
import { constants } from '@libs-shared'
import { matchups_actions } from '@core/matchups'

const current_week = Math.min(constants.week, constants.season.finalWeek)
const initial_week = Math.max(
  dayjs().day() === 2 ? current_week - 1 : current_week,
  1
)

const initialState = new Map({
  isLoaded: false,
  week: initial_week
})

export function scoreboard_reducer(state = initialState, { payload, type }) {
  switch (type) {
    case scoreboard_actions.UPDATE_SCOREBOARD_PLAYS:
    case scoreboard_actions.GET_SCOREBOARD_FULFILLED:
    case play_actions.GET_PLAYSTATS_FULFILLED:
      return state.set('isLoaded', true)

    case scoreboard_actions.SCOREBOARD_SELECT_WEEK:
      return state.merge({
        week: payload.week
      })

    case matchups_actions.SELECT_MATCHUP:
      if (payload.week === null || payload.week === undefined) {
        return state
      }

      return state.merge({
        week: payload.week
      })

    default:
      return state
  }
}
