import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const trade_actions = {
  ...create_api_action_types('POST_TRADE_PROPOSE'),
  ...create_api_action_types('POST_TRADE_CANCEL'),
  ...create_api_action_types('POST_TRADE_ACCEPT'),
  ...create_api_action_types('POST_TRADE_REJECT'),
  ...create_api_action_types('GET_TRADES'),

  SELECT_TRADE: 'SELECT_TRADE',
  select_trade: (tradeId) => ({
    type: trade_actions.SELECT_TRADE,
    payload: {
      tradeId
    }
  }),

  TRADE_SELECT_TEAM: 'TRADE_SELECT_TEAM',
  select_team: (teamId) => ({
    type: trade_actions.TRADE_SELECT_TEAM,
    payload: {
      teamId
    }
  }),

  TRADE_SET_PROJECTED_LINEUPS: 'TRADE_SET_PROJECTED_LINEUPS',
  set_projected_lineups: ({ proposingTeamLineups, acceptingTeamLineups }) => ({
    type: trade_actions.TRADE_SET_PROJECTED_LINEUPS,
    payload: {
      proposingTeamLineups,
      acceptingTeamLineups
    }
  }),

  LOAD_TRADES: 'LOAD_TRADES',
  load: () => ({
    type: trade_actions.LOAD_TRADES
  }),

  PROPOSE_TRADE: 'PROPOSE_TRADE',
  propose: () => ({
    type: trade_actions.PROPOSE_TRADE
  }),

  ACCEPT_TRADE: 'ACCEPT_TRADE',
  accept: () => ({
    type: trade_actions.ACCEPT_TRADE
  }),

  CANCEL_TRADE: 'CANCEL_TRADE',
  cancel: () => ({
    type: trade_actions.CANCEL_TRADE
  }),

  REJECT_TRADE: 'REJECT_TRADE',
  reject: () => ({
    type: trade_actions.REJECT_TRADE
  }),

  TRADE_SET_RELEASE_PLAYERS: 'TRADE_SET_RELEASE_PLAYERS',
  set_release_players: (players) => ({
    type: trade_actions.TRADE_SET_RELEASE_PLAYERS,
    payload: {
      players
    }
  }),

  TRADE_SET_PROPOSING_TEAM_PLAYERS: 'TRADE_SET_PROPOSING_TEAM_PLAYERS',
  set_proposing_team_players: (players) => ({
    type: trade_actions.TRADE_SET_PROPOSING_TEAM_PLAYERS,
    payload: {
      players
    }
  }),

  TRADE_SET_ACCEPTING_TEAM_PLAYERS: 'TRADE_SET_ACCEPTING_TEAM_PLAYERS',
  set_accepting_team_players: (players) => ({
    type: trade_actions.TRADE_SET_ACCEPTING_TEAM_PLAYERS,
    payload: {
      players
    }
  }),

  TRADE_SET_PROPOSING_TEAM_PICKS: 'TRADE_SET_PROPOSING_TEAM_PICKS',
  set_proposing_team_picks: (picks) => ({
    type: trade_actions.TRADE_SET_PROPOSING_TEAM_PICKS,
    payload: {
      picks
    }
  }),

  TRADE_SET_ACCEPTING_TEAM_PICKS: 'TRADE_SET_ACCEPTING_TEAM_PICKS',
  set_accepting_team_picks: (picks) => ({
    type: trade_actions.TRADE_SET_ACCEPTING_TEAM_PICKS,
    payload: {
      picks
    }
  })
}

export const post_trade_propose_actions =
  create_api_actions('POST_TRADE_PROPOSE')
export const get_trades_actions = create_api_actions('GET_TRADES')
export const post_trade_accept_actions = create_api_actions('POST_TRADE_ACCEPT')
export const post_trade_cancel_actions = create_api_actions('POST_TRADE_CANCEL')
export const post_trade_reject_actions = create_api_actions('POST_TRADE_REJECT')
