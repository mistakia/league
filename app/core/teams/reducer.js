import { Map } from 'immutable'

import { appActions } from '@core/app'
import { createTeam } from './team'
import { teamActions } from './actions'
import { auctionActions } from '@core/auction'
import { draftActions } from '@core/draft'

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

    case auctionActions.AUCTION_PROCESSED: {
      const newCap = state.get(payload.tid).get('acap') - payload.value
      return state.setIn([payload.tid, 'acap'], newCap)
    }

    case teamActions.PUT_TEAM_FULFILLED:
      return state.setIn(
        [payload.opts.teamId, payload.opts.field], payload.data.value
      )

    case draftActions.DRAFTED_PLAYER:
    case draftActions.POST_DRAFT_FULFILLED: {
      const { data } = payload
      const teamPicks = state.getIn([data.tid, 'picks'])
      const key = teamPicks.findKey(p => p.uid === data.uid)
      return state.setIn([data.tid, 'picks', key, 'player'], data.player)
    }

    default:
      return state
  }
}
