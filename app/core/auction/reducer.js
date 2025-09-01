import { Record, List } from 'immutable'

import { constants } from '@libs-shared'
import { auction_actions } from './actions'
import { app_actions } from '@core/app'

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
  pause_on_team_disconnect: true,
  is_slow_mode: false,
  user_has_passed_current_auction_nomination: false
})

export function auction_reducer(state = initialState(), { payload, type }) {
  switch (type) {
    case auction_actions.AUCTION_SEARCH_PLAYERS:
      return state.merge({
        search: payload.value
      })

    case auction_actions.AUCTION_CONNECTED:
      return state.merge({
        connected: new List(payload.connected)
      })

    case auction_actions.AUCTION_TOGGLE_MUTED:
      return state.merge({ muted: !state.muted })

    case auction_actions.AUCTION_RELEASE_LOCK:
      return state.merge({ isLocked: false })

    case auction_actions.AUCTION_FILTER:
      return state.merge({ [payload.type]: new List(payload.values) })

    case auction_actions.AUCTION_START: {
      const latest = state.transactions.first()
      return state.merge({
        isPaused: false,
        timer:
          latest && latest.type === constants.transactions.AUCTION_BID
            ? Math.round((Date.now() + state.bidTimer) / 1000)
            : Math.round((Date.now() + state.nominationTimer) / 1000)
      })
    }

    case auction_actions.AUCTION_SELECT_PLAYER:
      return state.merge({
        selected_pid: payload.pid,
        bid: 0
      })

    case auction_actions.AUCTION_BID:
      return state.merge({
        selected_pid: null,
        isPaused: false,
        transactions: state.transactions.unshift(payload),
        bid: payload.value,
        nominated_pid: payload.pid,
        timer: Math.round((Date.now() + state.bidTimer) / 1000),
        isLocked: true,
        user_has_passed_current_auction_nomination: false // Reset pass state on new bid
      })

    case auction_actions.AUCTION_PASS_NOMINATION:
      return state.merge({
        user_has_passed_current_auction_nomination: true
      })

    case auction_actions.AUCTION_SUBMIT_BID:
      return state.merge({
        isLocked: true
      })

    case auction_actions.AUCTION_PROCESSED:
      return state.merge({
        selected_pid: null,
        isPaused: false,
        bid: null,
        transactions: state.transactions.unshift(payload),
        nominated_pid: null,
        timer: Math.round((Date.now() + state.nominationTimer) / 1000)
      })

    case auction_actions.AUCTION_PAUSED:
      return state.merge({
        isPaused: true,
        timer: null
      })

    case auction_actions.AUCTION_NOMINATION_INFO: {
      const { nominatingTeamId } = payload
      return state.merge({ nominatingTeamId })
    }

    case auction_actions.AUCTION_INIT: {
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
        pause_on_team_disconnect: payload.pause_on_team_disconnect,
        is_slow_mode: payload.slow_mode || false,
        user_has_passed_current_auction_nomination:
          payload.user_has_passed_current_auction_nomination || false
      })
    }

    case auction_actions.AUCTION_CONFIG:
      return state.merge({
        pause_on_team_disconnect: payload.pause_on_team_disconnect
      })

    case auction_actions.AUCTION_COMPLETE:
      return state.merge({ isComplete: true })

    case auction_actions.SET_OPTIMAL_LINEUP:
      return state.merge({
        lineupPlayers: new List(payload.feasible ? payload.pids : []),
        lineupPoints: payload.result,
        lineupFeasible: payload.feasible
      })

    case auction_actions.SET_AUCTION_BUDGET:
      return state.merge({
        lineupBudget: payload.budget
      })

    case app_actions.AUTH_FULFILLED:
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
