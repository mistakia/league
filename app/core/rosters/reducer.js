import { Map } from 'immutable'
import { rosterActions } from './actions'
import { Roster, createRoster } from './roster'
import { appActions } from '@core/app'

export function rostersReducer (state = new Map(), { payload, type }) {
  switch (type) {
    case appActions.LOGOUT:
      return new Map()

    case rosterActions.LOAD_ROSTER:
      return state.set(payload.teamId, new Roster())

    case rosterActions.GET_ROSTER_PENDING:
      return state.setIn([payload.opts.teamId, 'isPending'], true)

    case rosterActions.GET_ROSTER_FAILED:
      return state.setIn([payload.opts.teamId, 'isPending'], true)

    case rosterActions.GET_ROSTER_FULFILLED:
      return state.set(payload.opts.teamId, createRoster(payload.data))

    case rosterActions.GET_ROSTERS_FULFILLED:
      return state.withMutations(state => {
        payload.data.forEach(r => state.set(r.tid, createRoster(r)))
      })

    case rosterActions.PUT_ROSTER_FULFILLED: {
      const players = state.getIn([payload.opts.teamId, 'players'])
      const index = players.findIndex(p => p.player === payload.data.player)
      return state.setIn([payload.opts.teamId, 'players', index, 'slot'], payload.data.slot)
    }

    default:
      return state
  }
}
