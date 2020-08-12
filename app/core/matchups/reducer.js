import { Map, List } from 'immutable'

import { matchupsActions } from './actions'
import { teamActions } from '@core/teams'
import { constants } from '@common'

const initialState = new Map({
  isPending: false,
  items: new List(),
  teams: new List(),
  weeks: new List(constants.season.weeks)
})

export function matchupsReducer (state = initialState, { payload, type }) {
  switch (type) {
    case matchupsActions.GET_MATCHUPS_FAILED:
      return state.merge({ isPending: false })

    case matchupsActions.GET_MATCHUPS_PENDING:
      return state.merge({ isPending: true })

    case teamActions.GET_TEAMS_FULFILLED:
      return state.merge({
        teams: new List(payload.data.teams.map(t => t.uid))
      })

    case matchupsActions.GET_MATCHUPS_FULFILLED:
      return state.merge({ items: new List(payload.data), isPending: false })

    case matchupsActions.FILTER_MATCHUPS:
      return state.merge({
        [payload.type]: new List(payload.values)
      })

    default:
      return state
  }
}
