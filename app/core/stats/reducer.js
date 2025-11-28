import { Record, List, Map } from 'immutable'

import { stat_actions } from './actions'
import { player_actions } from '@core/players'
import {
  current_season,
  nfl_weeks,
  game_days,
  nfl_quarters,
  nfl_downs,
  stat_qualification_thresholds
} from '@constants'

const initialState = new Record({
  isPending: false,
  plays: new List(),
  teamStats: new List(),
  qualifiers: new Map(stat_qualification_thresholds),
  years: new List([
    current_season.week ? current_season.year : current_season.year - 1
  ]),
  weeks: new List(nfl_weeks),
  days: new List(game_days),
  quarters: new List(nfl_quarters),
  downs: new List(nfl_downs),
  yardline_start: 0,
  yardline_end: 100,
  teamStatsPercentiles: new Record({})
})

export function stats_reducer(state = initialState(), { payload, type }) {
  switch (type) {
    case stat_actions.UPDATE_QUALIFIER:
      return state.setIn(
        ['qualifiers', payload.qualifier, 'value'],
        payload.value
      )

    case stat_actions.GET_CHARTED_PLAYS_PENDING:
      return state.merge({ isPending: true })

    case stat_actions.GET_CHARTED_PLAYS_FAILED:
      return state.merge({ isPending: false })

    case player_actions.SET_PLAYER_STATS:
      return state.merge({
        isPending: false
      })

    case stat_actions.SET_TEAM_STATS_PERCENTILES:
      return state.merge({ teamStatsPercentiles: payload.percentiles })

    case stat_actions.FILTER_STATS:
      return state.merge({ [payload.type]: new List(payload.values) })

    case stat_actions.FILTER_STATS_YARDLINE:
      return state.merge({ ...payload })

    case stat_actions.GET_CHARTED_PLAYS_FULFILLED:
      return state.merge({
        plays: new List(payload.data)
      })

    case stat_actions.GET_TEAM_STATS_FULFILLED:
      return state.merge({
        teamStats: new List(payload.data)
      })

    default:
      return state
  }
}
