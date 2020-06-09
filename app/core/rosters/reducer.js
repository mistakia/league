import { Map } from 'immutable'
import { rosterActions } from './actions'
import { Roster, createRoster } from './roster'

export function rostersReducer (state = new Map(), { payload, type }) {
  switch (type) {
    case rosterActions.LOAD_ROSTER:
      return state.set(payload.teamId, new Roster())

    case rosterActions.GET_ROSTER_PENDING:
      return state.setIn([payload.opts.teamId, 'isPending'], true)

    case rosterActions.GET_ROSTER_FAILED:
      return state.setIn([payload.opts.teamId, 'isPending'], true)

    case rosterActions.GET_ROSTER_FULFILLED:
      return state.set(payload.opts.teamId, createRoster(payload.data.rosters))

    default:
      return state
  }
}
