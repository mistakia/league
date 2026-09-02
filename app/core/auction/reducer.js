import { Record, List, Map, fromJS } from 'immutable'

import { transaction_types, fantasy_positions } from '#constants'
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
  positions: new List(fantasy_positions),
  bidTimer: null,
  nominationTimer: null,
  nominating_team_id: null,
  search: null,
  timer: null,
  muted: true,
  pause_on_team_disconnect: true,
  // 'election' or 'live'. Election mode carries no clock at all: a nominated
  // player settles when every eligible team has elected on it.
  auction_mode: 'live',
  // Team ids only, on the active nomination. A standing maximum is a sealed bid
  // -- no other team's amount ever reaches this client, the commissioner's
  // included, since the commissioner is a competing manager here.
  outstanding_election_tids: new List(),
  // Map<pid, Map> of THE VIEWING TEAM'S OWN live elections, and no others.
  // Bounded by the players one manager elected on rather than 395 by ten, and
  // sealed by construction: no other team's amount is ever sent to any client.
  //
  // fromJS maps rather than a Record, matching restricted-free-agency/reducer.js
  // -- app/core/auction/ has no record.js and adding one would pull the slice
  // under app.record-declares-reducer-key.spec.mjs for no gain.
  standing_elections: new Map()
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
          latest && latest.type === transaction_types.AUCTION_BID
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
        bid: payload.player_salary,
        nominated_pid: payload.pid,
        timer: Math.round((Date.now() + state.bidTimer) / 1000),
        isLocked: true
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
        // The outstanding set belongs to the player that just sold. Carrying it
        // into the next nomination would name teams against a player they have
        // not been asked about yet.
        outstanding_election_tids: new List(),
        timer: Math.round((Date.now() + state.nominationTimer) / 1000)
      })

    case auction_actions.AUCTION_PAUSED:
      return state.merge({
        isPaused: true,
        timer: null
      })

    case auction_actions.AUCTION_NOMINATION_INFO: {
      const { nominating_team_id } = payload
      return state.merge({ nominating_team_id })
    }

    case auction_actions.AUCTION_INIT: {
      const latest = payload.transactions[0]
      return state.merge({
        bid:
          latest && latest.type === transaction_types.AUCTION_BID
            ? latest.player_salary
            : null,
        nominated_pid:
          latest && latest.type === transaction_types.AUCTION_BID
            ? latest.pid
            : null,
        transactions: new List(payload.transactions),
        tids: new List(payload.tids),
        isPaused: payload.paused,
        bidTimer: payload.bidTimer,
        connected: new List(payload.connected),
        nominationTimer: payload.nominationTimer,
        nominating_team_id: payload.nominating_team_id,
        isComplete: payload.complete,
        pause_on_team_disconnect: payload.pause_on_team_disconnect,
        auction_mode: payload.auction_mode || 'live',
        outstanding_election_tids: new List(
          payload.outstanding_election_tids || []
        )
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
        lineupBudget: Math.round(payload.data.leagues[0].salary_cap * 0.9)
      })

    case auction_actions.GET_AUCTION_ELECTIONS_FULFILLED: {
      let elections = new Map()
      for (const election of payload.data) {
        elections = elections.set(election.pid, fromJS(election))
      }
      return state.merge({ standing_elections: elections })
    }

    case auction_actions.AUCTION_SETTLEMENT_STATUS:
      return state.merge({
        outstanding_election_tids: new List(
          payload.outstanding_election_tids || []
        )
      })

    default:
      return state
  }
}
