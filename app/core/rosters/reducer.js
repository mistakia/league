import { Map } from 'immutable'

import { rosterActions } from './actions'
import { Roster, createRoster } from './roster'
import { appActions } from '@core/app'
import { constants } from '@common'
import { auctionActions } from '@core/auction'
import { teamActions } from '@core/teams'

export function rostersReducer (state = new Map(), { payload, type }) {
  switch (type) {
    case appActions.LOGOUT:
      return new Map()

    case rosterActions.LOAD_ROSTER:
      return state.setIn([payload.teamId, constants.season.week], new Roster())

    case rosterActions.GET_ROSTER_PENDING:
      return state.setIn([payload.opts.teamId, constants.season.week, 'isPending'], true)

    case rosterActions.GET_ROSTER_FAILED:
      return state.setIn([payload.opts.teamId, constants.season.week, 'isPending'], true)

    case rosterActions.GET_ROSTER_FULFILLED:
      return state.setIn([payload.opts.teamId, constants.season.week], createRoster(payload.data))

    case rosterActions.GET_ROSTERS_FULFILLED:
      return state.withMutations(state => {
        payload.data.forEach(r => state.setIn([r.tid, payload.opts.week], createRoster(r)))
      })

    case auctionActions.AUCTION_PROCESSED: {
      const { tid, player, rid, pos, userid, value, type, year, timestamp, lid } = payload
      return state.updateIn([payload.tid, constants.season.week, 'players'], players => players.push({
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

    case rosterActions.POST_RELEASE_FULFILLED: {
      const players = state.getIn([payload.data.transaction.tid, constants.season.week, 'players'])
      if (!players) return state
      const key = players.findKey(p => p.player === payload.data.player)
      return state.deleteIn([payload.data.transaction.tid, constants.season.week, 'players', key])
    }

    case rosterActions.ROSTER_TRANSACTIONS: {
      return state.withMutations(state => {
        payload.data.forEach(p => {
          const t = p.transaction
          const players = state.getIn([t.tid, constants.season.week, 'players'])
          if (!players) return state

          const key = players.findKey(p => p.player === t.player)
          if (t.type === constants.transactions.ROSTER_RELEASE) {
            return state.deleteIn([t.tid, constants.season.week, 'players', key])
          } else {
            return state.updateIn([t.tid, constants.season.week, 'players'], arr => arr.push({
              rid: t.rid,
              slot: p.slot,
              player: t.player,
              pos: t.pos,
              userid: t.userid,
              tid: t.tid,
              lid: t.lid,
              type: t.type,
              value: t.value,
              year: t.year,
              timestamp: t.timestamp
            }))
          }
        })
      })
    }

    case rosterActions.PUT_ROSTER_FULFILLED: {
      return state.withMutations(state => {
        const tid = payload.data[0].tid
        const players = state.getIn([tid, constants.season.week, 'players'])
        if (!players) return state

        payload.data.forEach(({ player, slot }) => {
          const index = players.findIndex(p => p.player === player)
          state.setIn([tid, constants.season.week, 'players', index, 'slot'], slot)
        })
      })
    }

    case rosterActions.ROSTER_TRANSACTION:
    case rosterActions.POST_ACTIVATE_FULFILLED:
    case rosterActions.POST_DEACTIVATE_FULFILLED:
    case rosterActions.POST_RESERVE_FULFILLED: {
      return state.withMutations(state => {
        const players = state.getIn([payload.data.tid, constants.season.week, 'players'])
        if (!players) return state

        const index = players.findIndex(p => p.player === payload.data.player)
        state.setIn([payload.data.tid, constants.season.week, 'players', index, 'slot'], payload.data.slot)
        if (payload.data.transaction) {
          const { type, value, timestamp } = payload.data.transaction
          state.mergeIn([payload.data.tid, constants.season.week, 'players', index], {
            type,
            value,
            timestamp
          })
        }
      })
    }

    case rosterActions.SET_LINEUPS:
      return state.withMutations(state => {
        for (const teamId in payload.lineups) {
          const lineups = payload.lineups[teamId]
          for (const week in lineups) {
            const tid = parseInt(teamId, 10)
            state.setIn([tid, constants.season.week, 'lineups', week], lineups[week])
          }
        }
      })

    case teamActions.POST_TEAMS_FULFILLED:
      return state.setIn([payload.data.team.uid, constants.season.week], createRoster(payload.data.roster))

    case teamActions.DELETE_TEAMS_FULFILLED:
      return state.delete(payload.opts.teamId)

    case rosterActions.POST_ROSTERS_FULFILLED: {
      const { rid, slot, pos, player } = payload.data
      const { userid, tid, lid, type, value, year, timestamp } = payload.data.transaction
      return state.updateIn([payload.opts.teamId, constants.season.week, 'players'], arr => arr.push({
        rid,
        slot,
        player,
        pos,
        userid,
        tid,
        lid,
        type,
        value,
        year,
        timestamp
      }))
    }

    case rosterActions.PUT_ROSTERS_FULFILLED:
      return state // TODO

    case rosterActions.DELETE_ROSTERS_FULFILLED:
      return state.updateIn([payload.opts.teamId, constants.season.week, 'players'], arr => arr.filter(p => p.player !== payload.opts.player))

    default:
      return state
  }
}
