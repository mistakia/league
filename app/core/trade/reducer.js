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
  acceptingTeamLineups: new Map(),
  proposingTeamCurrentLineups: new Map(),
  acceptingTeamCurrentLineups: new Map(),
  proposingTeamSlots: new Map(), // Map of pid -> slot for players proposing team receives
  acceptingTeamSlots: new Map(), // Map of pid -> slot for players accepting team receives
  validationErrors: new Map(), // Map of team -> slot type -> error message
  action_error: null // the server's reason for refusing the last veto or approval
})

// The failed action carries `err.toString()`, which prefixes the server's
// message with the Error class name.
const read_error_message = (error) =>
  typeof error === 'string'
    ? error.replace(/^Error:\s*/, '')
    : 'Trade action failed'

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
        acceptingTeamLineups: new Map(payload.acceptingTeamLineups),
        proposingTeamCurrentLineups: new Map(
          payload.proposingTeamCurrentLineups
        ),
        acceptingTeamCurrentLineups: new Map(
          payload.acceptingTeamCurrentLineups
        )
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
    case trade_actions.POST_TRADE_REJECT_FULFILLED:
    case trade_actions.POST_TRADE_VETO_FULFILLED:
    case trade_actions.POST_TRADE_APPROVE_FULFILLED:
      return state.merge({
        selectedTradeId: payload.data.trade_id,
        items: state.items.set(
          payload.data.trade_id,
          create_trade(payload.data)
        ),
        action_error: null
      })

    // Either action starting clears the error: nothing ties the message to a
    // button, so leaving a refusal up reads as the action now in flight having
    // failed.
    case trade_actions.POST_TRADE_VETO_PENDING:
    case trade_actions.POST_TRADE_APPROVE_PENDING:
      return state.merge({ action_error: null })

    case trade_actions.POST_TRADE_VETO_FAILED:
    case trade_actions.POST_TRADE_APPROVE_FAILED:
      return state.merge({ action_error: read_error_message(payload.error) })

    case trade_actions.GET_TRADES_FULFILLED:
      return state.withMutations((state) => {
        payload.data.forEach((t) =>
          state.setIn(['items', t.trade_id], create_trade(t))
        )
      })

    case trade_actions.SELECT_TRADE:
      return state.merge({
        selectedTradeId: payload.tradeId,
        releasePlayers: new List(),
        acceptingTeamPlayers: new List(),
        proposingTeamPlayers: new List(),
        acceptingTeamPicks: new List(),
        proposingTeamPicks: new List(),
        proposingTeamSlots: new Map(),
        acceptingTeamSlots: new Map(),
        validationErrors: new Map(),
        action_error: null
      })

    case trade_actions.TRADE_SET_PROPOSING_TEAM_SLOT:
      return state.setIn(['proposingTeamSlots', payload.pid], payload.slot)

    case trade_actions.TRADE_SET_ACCEPTING_TEAM_SLOT:
      return state.setIn(['acceptingTeamSlots', payload.pid], payload.slot)

    case trade_actions.TRADE_SET_VALIDATION_ERRORS:
      return state.set('validationErrors', new Map(payload.errors))

    case trade_actions.TRADE_CLEAR_VALIDATION_ERRORS:
      return state.set('validationErrors', new Map())

    default:
      return state
  }
}
