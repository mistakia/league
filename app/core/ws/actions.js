export const wsActions = {
  WEBSOCKET_OPEN: 'WEBSOCKET_OPEN',
  WEBSOCKET_CLOSE: 'WEBSOCKET_CLOSE',

  WEBSOCKET_RECONNECTED: 'WEBSOCKET_RECONNECTED',

  reconnected: () => ({
    type: wsActions.WEBSOCKET_RECONNECTED
  }),

  close: () => ({
    type: wsActions.WEBSOCKET_CLOSE
  }),

  open: () => ({
    type: wsActions.WEBSOCKET_OPEN
  })
}
