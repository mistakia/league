import { Record, List, Map } from 'immutable'

import { create_trade } from './trade'
import { trade_actions } from './actions'

const initialState = new Record({
  teamId: null,
  selectedTradeId: null,
  items: new Map(),
  releasePlayers: new List(),
  acceptingTeamPlayers: new List(),
  proposingTeamPlayers: new List(),
  acceptingTeamPicks: new List(),
  proposingTeamPicks: new List(),
  proposingTeamLineups: new Map(),
  acceptingTeamLineups: new Map()
})

export function trade_reducer(state = initialState(), { payload, type }) {
  switch (type) {
    case trade_actions.TRADE_SELECT_TEAM:
      return state.merge({
        teamId: payload.teamId,
        acceptingTeamPlayers: new List(),
        acceptingTeamPicks: new List()
      })

    case trade_actions.TRADE_SET_PROJECTED_LINEUPS:
      return state.merge({
        proposingTeamLineups: new Map(payload.proposingTeamLineups),
        acceptingTeamLineups: new Map(payload.acceptingTeamLineups)
      })

    case trade_actions.TRADE_SET_RELEASE_PLAYERS:
      return state.merge({
        releasePlayers: new List(payload.players)
      })

    case trade_actions.TRADE_SET_ACCEPTING_TEAM_PLAYERS:
      return state.merge({
        acceptingTeamPlayers: new List(payload.players)
      })

    case trade_actions.TRADE_SET_PROPOSING_TEAM_PLAYERS:
      return state.merge({
        proposingTeamPlayers: new List(payload.players)
      })

    case trade_actions.TRADE_SET_PROPOSING_TEAM_PICKS:
      return state.merge({
        proposingTeamPicks: new List(payload.picks)
      })

    case trade_actions.TRADE_SET_ACCEPTING_TEAM_PICKS:
      return state.merge({
        acceptingTeamPicks: new List(payload.picks)
      })

    case trade_actions.POST_TRADE_ACCEPT_FULFILLED:
    case trade_actions.POST_TRADE_CANCEL_FULFILLED:
    case trade_actions.POST_TRADE_PROPOSE_FULFILLED:
      return state.merge({
        selectedTradeId: payload.data.uid,
        items: state.items.set(payload.data.uid, create_trade(payload.data))
      })

    case trade_actions.GET_TRADES_FULFILLED:
      return state.withMutations((state) => {
        payload.data.forEach((t) =>
          state.setIn(['items', t.uid], create_trade(t))
        )
      })

    case trade_actions.SELECT_TRADE:
      return state.merge({
        selectedTradeId: payload.tradeId,
        releasePlayers: new List(),
        acceptingTeamPlayers: new List(),
        proposingTeamPlayers: new List(),
        acceptingTeamPicks: new List(),
        proposingTeamPicks: new List()
      })

    default:
      return state
  }
}
