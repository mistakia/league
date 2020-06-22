import { Record, List, Map } from 'immutable'

import { createTrade } from './trade'
import { tradeActions } from './actions'

const initialState = new Record({
  teamId: null,
  selectedTradeId: null,
  items: new Map(),
  dropPlayers: new List(),
  receivePlayers: new List(),
  sendPlayers: new List(),
  receivePicks: new Map(),
  sendPicks: new Map()
})

export function tradeReducer (state = initialState(), { payload, type }) {
  switch (type) {
    case tradeActions.TRADE_SELECT_TEAM:
      return state.merge({
        teamId: payload.teamId,
        receivePlayers: new List(),
        receivePicks: new Map()
      })

    case tradeActions.TRADE_TOGGLE_DROP_PLAYER: {
      const { player } = payload
      const index = state.dropPlayers.indexOf(player)
      return state.merge({
        dropPlayers: index === -1 ? state.dropPlayers.push(player) : state.dropPlayers.delete(index)
      })
    }

    case tradeActions.TRADE_TOGGLE_RECEIVE_PLAYER: {
      const { player } = payload
      const index = state.receivePlayers.indexOf(player)
      return state.merge({
        receivePlayers: index === -1 ? state.receivePlayers.push(player) : state.receivePlayers.delete(index)
      })
    }

    case tradeActions.TRADE_TOGGLE_SEND_PLAYER: {
      const { player } = payload
      const index = state.sendPlayers.indexOf(player)
      return state.merge({
        sendPlayers: index === -1 ? state.sendPlayers.push(player) : state.sendPlayers.delete(index)
      })
    }

    case tradeActions.TRADE_TOGGLE_SEND_PICK: {
      const { uid } = payload.pick
      return state.merge({
        sendPicks: state.sendPicks.has(uid)
          ? state.sendPicks.delete(uid)
          : state.sendPicks.set(uid, payload.pick)
      })
    }

    case tradeActions.TRADE_TOGGLE_RECEIVE_PICK: {
      const { uid } = payload.pick
      return state.merge({
        receivePicks: state.receivePicks.has(uid)
          ? state.receivePicks.delete(uid)
          : state.receivePicks.set(uid, payload.pick)
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
        receivePlayers: new List(),
        sendPlayers: new List(),
        receivePicks: new Map(),
        sendPicks: new Map()
      })

    default:
      return state
  }
}
