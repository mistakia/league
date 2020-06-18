import { Map } from 'immutable'

import { appActions } from '@core/app'
import { createTeam } from './team'
import { teamActions } from './actions'
import { auctionActions } from '@core/auction'

const initialState = new Map()

export function teamsReducer (state = initialState, { payload, type }) {
  switch (type) {
    case appActions.AUTH_FULFILLED:
      return state.withMutations(state => {
        payload.data.teams.forEach(t => state.set(t.uid, createTeam(t)))
      })

    case appActions.LOGOUT:
      return initialState

    case teamActions.GET_TEAMS_FULFILLED:
      return state.withMutations(state => {
        payload.data.teams.forEach(t => state.set(t.uid, createTeam(t)))
      })

    case auctionActions.AUCTION_INIT:
      return state.withMutations(state => {
        payload.teams.forEach(t => state.set(t.uid, createTeam(t)))
      })

    case auctionActions.AUCTION_PROCESSED:
      const newCap = state.get(payload.tid).get('acap') - payload.value
      return state.setIn([payload.tid, 'acap'], newCap)

    default:
      return state
  }
}
