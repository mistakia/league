import { Record, List } from 'immutable'

import { constants } from '@libs-shared'
import { auctionActions } from './actions'
import { appActions } from '@core/app'

const initialState = new Record({
  isPaused: true,
  isLocked: false,
  isComplete: false,
  selected_pid: null,
  nominated_pid: null,
  bid: null,
  connected: new List(),
  lineupPlayers: new List(),
  lineupFeasible: true,
  lineupPoints: null,
  lineupBudget: null,
  tids: new List(),
  transactions: new List(),
  positions: new List(constants.positions),
  bidTimer: null,
  nominationTimer: null,
  nominatingTeamId: null,
  search: null,
  timer: null,
  muted: true,
  pause_on_team_disconnect: true
})

export function auctionReducer(state = initialState(), { payload, type }) {
  switch (type) {
    case auctionActions.AUCTION_SEARCH_PLAYERS:
      return state.merge({
        search: payload.value
      })

    case auctionActions.AUCTION_CONNECTED:
      return state.merge({
        connected: new List(payload.connected)
      })

    case auctionActions.AUCTION_TOGGLE_MUTED:
      return state.merge({ muted: !state.muted })

    case auctionActions.AUCTION_RELEASE_LOCK:
      return state.merge({ isLocked: false })

    case auctionActions.AUCTION_FILTER:
      return state.merge({ [payload.type]: new List(payload.values) })

    case auctionActions.AUCTION_START: {
      const latest = state.transactions.first()
      return state.merge({
        isPaused: false,
        timer:
          latest && latest.type === constants.transactions.AUCTION_BID
            ? Math.round((Date.now() + state.bidTimer) / 1000)
            : Math.round((Date.now() + state.nominationTimer) / 1000)
      })
    }

    case auctionActions.AUCTION_SELECT_PLAYER:
      return state.merge({
        selected_pid: payload.pid,
        bid: 0
      })

    case auctionActions.AUCTION_BID:
      return state.merge({
        selected_pid: null,
        isPaused: false,
        transactions: state.transactions.unshift(payload),
        bid: payload.value,
        nominated_pid: payload.pid,
        timer: Math.round((Date.now() + state.bidTimer) / 1000),
        isLocked: true
      })

    case auctionActions.AUCTION_SUBMIT_BID:
      return state.merge({
        isLocked: true
      })

    case auctionActions.AUCTION_PROCESSED:
      return state.merge({
        selected_pid: null,
        isPaused: false,
        bid: null,
        transactions: state.transactions.unshift(payload),
        nominated_pid: null,
        timer: Math.round((Date.now() + state.nominationTimer) / 1000)
      })

    case auctionActions.AUCTION_PAUSED:
      return state.merge({
        isPaused: true,
        timer: null
      })

    case auctionActions.AUCTION_NOMINATION_INFO: {
      const { nominatingTeamId } = payload
      return state.merge({ nominatingTeamId })
    }

    case auctionActions.AUCTION_INIT: {
      const latest = payload.transactions[0]
      return state.merge({
        bid:
          latest && latest.type === constants.transactions.AUCTION_BID
            ? latest.value
            : null,
        nominated_pid:
          latest && latest.type === constants.transactions.AUCTION_BID
            ? latest.pid
            : null,
        transactions: new List(payload.transactions),
        tids: new List(payload.tids),
        isPaused: payload.paused,
        bidTimer: payload.bidTimer,
        connected: new List(payload.connected),
        nominationTimer: payload.nominationTimer,
        nominatingTeamId: payload.nominatingTeamId,
        isComplete: payload.complete,
        pause_on_team_disconnect: payload.pause_on_team_disconnect
      })
    }

    case auctionActions.AUCTION_CONFIG:
      return state.merge({
        pause_on_team_disconnect: payload.pause_on_team_disconnect
      })

    case auctionActions.AUCTION_COMPLETE:
      return state.merge({ isComplete: true })

    case auctionActions.SET_OPTIMAL_LINEUP:
      return state.merge({
        lineupPlayers: new List(payload.feasible ? payload.pids : []),
        lineupPoints: payload.result,
        lineupFeasible: payload.feasible
      })

    case auctionActions.SET_AUCTION_BUDGET:
      return state.merge({
        lineupBudget: payload.budget
      })

    case appActions.AUTH_FULFILLED:
      if (!payload.data.leagues.length) {
        return state
      }

      return state.merge({
        lineupBudget: Math.round(payload.data.leagues[0].cap * 0.9)
      })

    default:
      return state
  }
}
