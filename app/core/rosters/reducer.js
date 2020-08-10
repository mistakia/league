import { Map } from 'immutable'

import { rosterActions } from './actions'
import { Roster, createRoster } from './roster'
import { appActions } from '@core/app'
import { constants } from '@common'
import { auctionActions } from '@core/auction'

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

    case auctionActions.AUCTION_PROCESSED: {
      const { tid, player, rid, pos, userid, value, type, year, timestamp, lid } = payload
      return state.updateIn([payload.tid, 'players'], players => players.push({
        rid,
        slot: constants.slots.BENCH,
        player,
        pos,
        userid,
        value,
        type,
        year,
        timestamp,
        tid,
        lid
      }))
    }

    case rosterActions.POST_ACTIVATE_FULFILLED:
    case rosterActions.POST_DEACTIVATE_FULFILLED:
    case rosterActions.PUT_ROSTER_FULFILLED: {
      return state.withMutations(state => {
        const players = state.getIn([payload.opts.teamId, 'players'])
        const index = players.findIndex(p => p.player === payload.data.player)
        state.setIn([payload.opts.teamId, 'players', index, 'slot'], payload.data.slot)
        if (payload.data.transaction) {
          state.setIn([payload.opts.teamId, 'players', index, 'type'], payload.data.transaction.type)
          state.setIn([payload.opts.teamId, 'players', index, 'timestamp'], payload.data.transaction.timestamp)
        }
      })
    }

    default:
      return state
  }
}
