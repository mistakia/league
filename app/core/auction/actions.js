export const auction_actions = {
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

  AUCTION_PASS_NOMINATION: 'AUCTION_PASS_NOMINATION',

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
  }),

  pass_nomination: () => ({
    type: auction_actions.AUCTION_PASS_NOMINATION
  })
}
