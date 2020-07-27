import { Record, List, Map } from 'immutable'

import { createTrade } from './trade'
import { tradeActions } from './actions'

const initialState = new Record({
  teamId: null,
  selectedTradeId: null,
  items: new Map(),
  dropPlayers: new List(),
  acceptingTeamPlayers: new List(),
  proposingTeamPlayers: new List(),
  acceptingTeamPicks: new Map(),
  proposingTeamPicks: new Map()
})

export function tradeReducer (state = initialState(), { payload, type }) {
  switch (type) {
    case tradeActions.TRADE_SELECT_TEAM:
      return state.merge({
        teamId: payload.teamId,
        acceptingTeamPlayers: new List(),
        acceptingTeamPicks: new Map()
      })

    case tradeActions.TRADE_TOGGLE_DROP_PLAYER: {
      const { player } = payload
      const index = state.dropPlayers.indexOf(player)
      return state.merge({
        dropPlayers: index === -1 ? state.dropPlayers.push(player) : state.dropPlayers.delete(index)
      })
    }

    case tradeActions.TRADE_TOGGLE_ACCEPTING_TEAM_PLAYER: {
      const { player } = payload
      const index = state.acceptingTeamPlayers.indexOf(player)
      return state.merge({
        acceptingTeamPlayers: index === -1 ? state.acceptingTeamPlayers.push(player) : state.acceptingTeamPlayers.delete(index)
      })
    }

    case tradeActions.TRADE_TOGGLE_PROPOSING_TEAM_PLAYER: {
      const { player } = payload
      const index = state.proposingTeamPlayers.indexOf(player)
      return state.merge({
        proposingTeamPlayers: index === -1 ? state.proposingTeamPlayers.push(player) : state.proposingTeamPlayers.delete(index)
      })
    }

    case tradeActions.TRADE_TOGGLE_PROPOSING_TEAM_PICK: {
      const { uid } = payload.pick
      return state.merge({
        proposingTeamPicks: state.proposingTeamPicks.has(uid)
          ? state.proposingTeamPicks.delete(uid)
          : state.proposingTeamPicks.set(uid, payload.pick)
      })
    }

    case tradeActions.TRADE_TOGGLE_ACCEPTING_TEAM_PICK: {
      const { uid } = payload.pick
      return state.merge({
        acceptingTeamPicks: state.acceptingTeamPicks.has(uid)
          ? state.acceptingTeamPicks.delete(uid)
          : state.acceptingTeamPicks.set(uid, payload.pick)
      })
    }

    case tradeActions.POST_TRADE_ACCEPT_FULFILLED:
    case tradeActions.POST_TRADE_CANCEL_FULFILLED:
    case tradeActions.POST_TRADE_PROPOSE_FULFILLED:
      return state.merge({
        items: state.items.set(payload.data.uid, createTrade(payload.data))
      })

    case tradeActions.GET_TRADES_FULFILLED:
      return state.withMutations(state => {
        payload.data.forEach(t => state.setIn(['items', t.uid], createTrade(t)))
      })

    case tradeActions.SELECT_TRADE:
      return state.merge({
        selectedTradeId: payload.tradeId,
        dropPlayers: new List(),
        acceptingTeamPlayers: new List(),
        proposingTeamPlayers: new List(),
        acceptingTeamPicks: new Map(),
        proposingTeamPicks: new Map()
      })

    default:
      return state
  }
}
