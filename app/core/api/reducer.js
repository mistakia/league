import { Map } from 'immutable'

import { percentileActions } from '@core/percentiles'
import { seasonlogsActions } from '@core/seasonlogs'
import { matchupsActions } from '@core/matchups'

const initialState = new Map({
  request_history: new Map()
})

export function apiReducer(state = initialState, { payload, type }) {
  switch (type) {
    case percentileActions.GET_PERCENTILES_PENDING:
      return state.setIn(
        ['request_history', `GET_PERCENTILES_${payload.opts.percentile_key}`],
        true
      )

    case percentileActions.GET_PERCENTILES_FAILED:
      return state.deleteIn([
        'request_history',
        `GET_PERCENTILES_${payload.opts.percentile_key}`
      ])

    case seasonlogsActions.GET_NFL_TEAM_SEASONLOGS_PENDING:
      return state.setIn(
        [
          'request_history',
          `GET_NFL_TEAM_SEASONLOGS_LEAGUE_${payload.opts.leagueId}`
        ],
        true
      )

    case seasonlogsActions.GET_NFL_TEAM_SEASONLOGS_FULFILLED:
      return state.deleteIn([
        'request_history',
        `GET_NFL_TEAM_SEASONLOGS_LEAGUE_${payload.opts.leagueId}`
      ])

    case matchupsActions.GET_MATCHUPS_PENDING:
      return state.setIn(
        [
          'request_history',
          `GET_MATCHUPS_LEAGUE_${payload.opts.leagueId}_${payload.opts.year}`
        ],
        true
      )

    case matchupsActions.GET_MATCHUPS_FAILED:
      return state.deleteIn([
        'request_history',
        `GET_MATCHUPS_LEAGUE_${payload.opts.leagueId}_${payload.opts.year}`
      ])

    default:
      return state
  }
}
