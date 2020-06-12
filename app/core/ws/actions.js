export const wsActions = {
  WEBSOCKET_OPEN: 'WEBSOCKET_OPEN',
  WEBSOCKET_CLOSE: 'WEBSOCKET_CLOSE',

  close: () => ({
    type: wsActions.WEBSOCKET_CLOSE
  }),

  open: () => ({
    type: wsActions.WEBSOCKET_OPEN
  })
}
