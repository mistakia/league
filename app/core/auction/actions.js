import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const auction_actions = {
  // Elections travel over REST, not the socket, because they are accepted for
  // the whole free agency period rather than only while a player is open.
  // `create_api_action_types` and `create_api_actions` are declared together on
  // purpose: app.action-type-registration.spec.mjs fails a module that exports
  // one without the other.
  ...create_api_action_types('GET_AUCTION_ELECTIONS'),
  ...create_api_action_types('POST_AUCTION_ELECTION'),
  ...create_api_action_types('DELETE_AUCTION_ELECTION'),

  LOAD_AUCTION_ELECTIONS: 'LOAD_AUCTION_ELECTIONS',
  load_auction_elections: ({ leagueId, teamId }) => ({
    type: auction_actions.LOAD_AUCTION_ELECTIONS,
    payload: { leagueId: Number(leagueId), teamId: Number(teamId) }
  }),

  SUBMIT_AUCTION_ELECTION: 'SUBMIT_AUCTION_ELECTION',
  // `maximum_bid` null IS the decline. One action for both, because they are
  // one concept: a decline is a maximum bid at the current price, and the null
  // is what makes it rank below every number at settlement.
  submit_auction_election: ({ leagueId, teamId, pid, maximum_bid = null }) => ({
    type: auction_actions.SUBMIT_AUCTION_ELECTION,
    payload: {
      leagueId: Number(leagueId),
      teamId: Number(teamId),
      pid,
      maximum_bid
    }
  }),

  WITHDRAW_AUCTION_ELECTION: 'WITHDRAW_AUCTION_ELECTION',
  withdraw_auction_election: ({ leagueId, teamId, pid }) => ({
    type: auction_actions.WITHDRAW_AUCTION_ELECTION,
    payload: { leagueId: Number(leagueId), teamId: Number(teamId), pid }
  }),

  AUCTION_JOIN: 'AUCTION_JOIN',

  AUCTION_ERROR: 'AUCTION_ERROR',
  AUCTION_PROCESSED: 'AUCTION_PROCESSED',
  AUCTION_BID: 'AUCTION_BID',
  AUCTION_INIT: 'AUCTION_INIT',
  AUCTION_START: 'AUCTION_START',
  AUCTION_PAUSED: 'AUCTION_PAUSED',
  AUCTION_CONNECTED: 'AUCTION_CONNECTED',
  AUCTION_NOMINATION_INFO: 'AUCTION_NOMINATION_INFO',
  AUCTION_COMPLETE: 'AUCTION_COMPLETE',

  AUCTION_SETTLEMENT_STATUS: 'AUCTION_SETTLEMENT_STATUS',

  AUCTION_TOGGLE_PAUSE_ON_TEAM_DISCONNECT:
    'AUCTION_TOGGLE_PAUSE_ON_TEAM_DISCONNECT',
  AUCTION_TOGGLE_MUTED: 'AUCTION_TOGGLE_MUTED',

  AUCTION_PAUSE: 'AUCTION_PAUSE',
  AUCTION_RESUME: 'AUCTION_RESUME',

  AUCTION_CONFIG: 'AUCTION_CONFIG',

  AUCTION_RELEASE_LOCK: 'AUCTION_RELEASE_LOCK',

  AUCTION_FILTER: 'AUCTION_FILTER',
  AUCTION_SEARCH_PLAYERS: 'AUCTION_SEARCH_PLAYERS',

  AUCTION_SELECT_PLAYER: 'AUCTION_SELECT_PLAYER',
  AUCTION_SUBMIT_NOMINATION: 'AUCTION_SUBMIT_NOMINATION',
  AUCTION_SUBMIT_BID: 'AUCTION_SUBMIT_BID',

  SET_OPTIMAL_LINEUP: 'SET_OPTIMAL_LINEUP',
  SET_AUCTION_BUDGET: 'SET_AUCTION_BUDGET',

  SOUND_NOTIFICATION: 'SOUND_NOTIFICATION',

  soundNotification: () => ({
    type: auction_actions.SOUND_NOTIFICATION
  }),

  toggleMuted: () => ({
    type: auction_actions.AUCTION_TOGGLE_MUTED
  }),

  setOptimalLineup: ({ pids, feasible, result }) => ({
    type: auction_actions.SET_OPTIMAL_LINEUP,
    payload: {
      pids,
      feasible,
      result
    }
  }),

  setBudget: (budget) => ({
    type: auction_actions.SET_AUCTION_BUDGET,
    payload: {
      budget
    }
  }),

  release: () => ({
    type: auction_actions.AUCTION_RELEASE_LOCK
  }),

  filter: ({ type, values }) => ({
    type: auction_actions.AUCTION_FILTER,
    payload: {
      type,
      values
    }
  }),

  search: (value) => ({
    type: auction_actions.AUCTION_SEARCH_PLAYERS,
    payload: {
      value
    }
  }),

  select: (pid) => ({
    type: auction_actions.AUCTION_SELECT_PLAYER,
    payload: {
      pid
    }
  }),

  nominate: (value) => ({
    type: auction_actions.AUCTION_SUBMIT_NOMINATION,
    payload: {
      value
    }
  }),

  bid: (value) => ({
    type: auction_actions.AUCTION_SUBMIT_BID,
    payload: {
      value
    }
  }),

  join: () => ({
    type: auction_actions.AUCTION_JOIN
  }),

  pause: () => ({
    type: auction_actions.AUCTION_PAUSE
  }),

  resume: () => ({
    type: auction_actions.AUCTION_RESUME
  }),

  toggle_pause_on_team_disconnect: () => ({
    type: auction_actions.AUCTION_TOGGLE_PAUSE_ON_TEAM_DISCONNECT
  })
}

export const get_auction_elections_actions = create_api_actions(
  'GET_AUCTION_ELECTIONS'
)
export const post_auction_election_actions = create_api_actions(
  'POST_AUCTION_ELECTION'
)
export const delete_auction_election_actions = create_api_actions(
  'DELETE_AUCTION_ELECTION'
)
