import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const tradeActions = {
  ...create_api_action_types('POST_TRADE_PROPOSE'),
  ...create_api_action_types('POST_TRADE_CANCEL'),
  ...create_api_action_types('POST_TRADE_ACCEPT'),
  ...create_api_action_types('POST_TRADE_REJECT'),
  ...create_api_action_types('GET_TRADES'),

  SELECT_TRADE: 'SELECT_TRADE',
  selectTrade: (tradeId) => ({
    type: tradeActions.SELECT_TRADE,
    payload: {
      tradeId
    }
  }),

  TRADE_SELECT_TEAM: 'TRADE_SELECT_TEAM',
  selectTeam: (teamId) => ({
    type: tradeActions.TRADE_SELECT_TEAM,
    payload: {
      teamId
    }
  }),

  TRADE_SET_PROJECTED_LINEUPS: 'TRADE_SET_PROJECTED_LINEUPS',
  setProjectedLineups: ({ proposingTeamLineups, acceptingTeamLineups }) => ({
    type: tradeActions.TRADE_SET_PROJECTED_LINEUPS,
    payload: {
      proposingTeamLineups,
      acceptingTeamLineups
    }
  }),

  LOAD_TRADES: 'LOAD_TRADES',
  load: () => ({
    type: tradeActions.LOAD_TRADES
  }),

  PROPOSE_TRADE: 'PROPOSE_TRADE',
  propose: () => ({
    type: tradeActions.PROPOSE_TRADE
  }),

  ACCEPT_TRADE: 'ACCEPT_TRADE',
  accept: () => ({
    type: tradeActions.ACCEPT_TRADE
  }),

  CANCEL_TRADE: 'CANCEL_TRADE',
  cancel: () => ({
    type: tradeActions.CANCEL_TRADE
  }),

  REJECT_TRADE: 'REJECT_TRADE',
  reject: () => ({
    type: tradeActions.REJECT_TRADE
  }),

  TRADE_SET_RELEASE_PLAYERS: 'TRADE_SET_RELEASE_PLAYERS',
  setReleasePlayers: (players) => ({
    type: tradeActions.TRADE_SET_RELEASE_PLAYERS,
    payload: {
      players
    }
  }),

  TRADE_SET_PROPOSING_TEAM_PLAYERS: 'TRADE_SET_PROPOSING_TEAM_PLAYERS',
  setProposingTeamPlayers: (players) => ({
    type: tradeActions.TRADE_SET_PROPOSING_TEAM_PLAYERS,
    payload: {
      players
    }
  }),

  TRADE_SET_ACCEPTING_TEAM_PLAYERS: 'TRADE_SET_ACCEPTING_TEAM_PLAYERS',
  setAcceptingTeamPlayers: (players) => ({
    type: tradeActions.TRADE_SET_ACCEPTING_TEAM_PLAYERS,
    payload: {
      players
    }
  }),

  TRADE_SET_PROPOSING_TEAM_PICKS: 'TRADE_SET_PROPOSING_TEAM_PICKS',
  setProposingTeamPicks: (picks) => ({
    type: tradeActions.TRADE_SET_PROPOSING_TEAM_PICKS,
    payload: {
      picks
    }
  }),

  TRADE_SET_ACCEPTING_TEAM_PICKS: 'TRADE_SET_ACCEPTING_TEAM_PICKS',
  setAcceptingTeamPicks: (picks) => ({
    type: tradeActions.TRADE_SET_ACCEPTING_TEAM_PICKS,
    payload: {
      picks
    }
  })
}

export const postTradeProposeActions = create_api_actions('POST_TRADE_PROPOSE')
export const getTradesActions = create_api_actions('GET_TRADES')
export const postTradeAcceptActions = create_api_actions('POST_TRADE_ACCEPT')
export const postTradeCancelActions = create_api_actions('POST_TRADE_CANCEL')
export const postTradeRejectActions = create_api_actions('POST_TRADE_REJECT')
