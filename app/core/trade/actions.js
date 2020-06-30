export const tradeActions = {
  TRADE_SELECT_TEAM: 'TRADE_SELECT_TEAM',
  TRADE_TOGGLE_RECEIVE_PLAYER: 'TRADE_TOGGLE_RECEIVE_PLAYER',
  TRADE_TOGGLE_SEND_PLAYER: 'TRADE_TOGGLE_SEND_PLAYER',
  TRADE_TOGGLE_RECEIVE_PICK: 'TRADE_TOGGLE_RECEIVE_PICK',
  TRADE_TOGGLE_SEND_PICK: 'TRADE_TOGGLE_SEND_PICK',
  TRADE_TOGGLE_DROP_PLAYER: 'TRADE_TOGGLE_DROP_PLAYER',

  SELECT_TRADE: 'SELECT_TRADE',
  PROPOSE_TRADE: 'PROPOSE_TRADE',
  ACCEPT_TRADE: 'ACCEPT_TRADE',
  CANCEL_TRADE: 'CANCEL_TRADE',

  POST_TRADE_PROPOSE_FAILED: 'POST_TRADE_PROPOSE_FAILED',
  POST_TRADE_PROPOSE_PENDING: 'POST_TRADE_PROPOSE_PENDING',
  POST_TRADE_PROPOSE_FULFILLED: 'POST_TRADE_PROPOSE_FULFILLED',

  POST_TRADE_CANCEL_FAILED: 'POST_TRADE_CANCEL_FAILED',
  POST_TRADE_CANCEL_PENDING: 'POST_TRADE_CANCEL_PENDING',
  POST_TRADE_CANCEL_FULFILLED: 'POST_TRADE_CANCEL_FULFILLED',

  POST_TRADE_ACCEPT_FAILED: 'POST_TRADE_ACCEPT_FAILED',
  POST_TRADE_ACCEPT_PENDING: 'POST_TRADE_ACCEPT_PENDING',
  POST_TRADE_ACCEPT_FULFILLED: 'POST_TRADE_ACCEPT_FULFILLED',

  LOAD_TRADES: 'LOAD_TRADES',

  GET_TRADES_FAILED: 'GET_TRADES_FAILED',
  GET_TRADES_PENDING: 'GET_TRADES_PENDING',
  GET_TRADES_FULFILLED: 'GET_TRADES_FULFILLED',

  selectTrade: (tradeId) => ({
    type: tradeActions.SELECT_TRADE,
    payload: {
      tradeId
    }
  }),

  selectTeam: (teamId) => ({
    type: tradeActions.TRADE_SELECT_TEAM,
    payload: {
      teamId
    }
  }),

  load: () => ({
    type: tradeActions.LOAD_TRADES
  }),

  accept: () => ({
    type: tradeActions.ACCEPT_TRADE
  }),

  cancel: () => ({
    type: tradeActions.CANCEL_TRADE
  }),

  toggleDropPlayer: (player) => ({
    type: tradeActions.TRADE_TOGGLE_DROP_PLAYER,
    payload: {
      player
    }
  }),

  toggleSendPlayer: (player) => ({
    type: tradeActions.TRADE_TOGGLE_SEND_PLAYER,
    payload: {
      player
    }
  }),

  toggleReceivePlayer: (player) => ({
    type: tradeActions.TRADE_TOGGLE_RECEIVE_PLAYER,
    payload: {
      player
    }
  }),

  toggleSendPick: (pick) => ({
    type: tradeActions.TRADE_TOGGLE_SEND_PICK,
    payload: {
      pick
    }
  }),

  toggleReceivePick: (pick) => ({
    type: tradeActions.TRADE_TOGGLE_RECEIVE_PICK,
    payload: {
      pick
    }
  }),

  propose: () => ({
    type: tradeActions.PROPOSE_TRADE
  }),

  postTradeProposeFailed: (opts, error) => ({
    type: tradeActions.POST_TRADE_PROPOSE_FAILED,
    payload: {
      opts,
      error
    }
  }),

  postTradeProposePending: (opts) => ({
    type: tradeActions.POST_TRADE_PROPOSE_PENDING,
    payload: {
      opts
    }
  }),

  postTradeProposeFulfilled: (opts, data) => ({
    type: tradeActions.POST_TRADE_PROPOSE_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getTradesPending: (opts) => ({
    type: tradeActions.GET_TRADES_PENDING,
    payload: {
      opts
    }
  }),

  getTradesFulfilled: (opts, data) => ({
    type: tradeActions.GET_TRADES_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  getTradesFailed: (opts, error) => ({
    type: tradeActions.GET_TRADES_FAILED,
    payload: {
      opts,
      error
    }
  }),

  postTradeCancelFailed: (opts, error) => ({
    type: tradeActions.POST_TRADE_CANCEL_FAILED,
    payload: {
      opts,
      error
    }
  }),

  postTradeCancelPending: opts => ({
    type: tradeActions.POST_TRADE_CANCEL_PENDING,
    payload: {
      opts
    }
  }),

  postTradeCancelFulfilled: (opts, data) => ({
    type: tradeActions.POST_TRADE_CANCEL_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  postTradeAcceptFailed: (opts, error) => ({
    type: tradeActions.POST_TRADE_ACCEPT_FAILED,
    payload: {
      opts,
      error
    }
  }),

  postTradeAcceptPending: opts => ({
    type: tradeActions.POST_TRADE_ACCEPT_PENDING,
    payload: {
      opts
    }
  }),

  postTradeAcceptFulfilled: (opts, data) => ({
    type: tradeActions.POST_TRADE_ACCEPT_FULFILLED,
    payload: {
      opts,
      data
    }
  })
}

export const postTradeProposeActions = {
  failed: tradeActions.postTradeProposeFailed,
  pending: tradeActions.postTradeProposePending,
  fulfilled: tradeActions.postTradeProposeFulfilled
}

export const getTradesActions = {
  failed: tradeActions.getTradesFailed,
  pending: tradeActions.getTradesPending,
  fulfilled: tradeActions.getTradesFulfilled
}

export const postTradeAcceptActions = {
  failed: tradeActions.postTradeAcceptFailed,
  pending: tradeActions.postTradeAcceptPending,
  fulfilled: tradeActions.postTradeAcceptFulfilled
}

export const postTradeCancelActions = {
  failed: tradeActions.postTradeCancelFailed,
  pending: tradeActions.postTradeCancelPending,
  fulfilled: tradeActions.postTradeCancelFulfilled
}
