/* global IS_DEV, MACHINE_IP */

// MACHINE_IP is defined in webpack.config.dev.babel.mjs
// it is used instead of localhost to allow the app to be accessed from
// other devices on the same network (i.e. testing on a mobile phone)

export const BASE_URL = IS_DEV
  ? 'http://' + MACHINE_IP + ':8082/api'
  : 'https://xo.football/api'
export const WS_URL = IS_DEV
  ? 'ws://' + MACHINE_IP + ':8082'
  : 'wss://xo.football'
export const DOCS_URL =
  'https://api.github.com/repos/mistakia/league/contents/docs'

export const TRANSACTIONS_PER_LOAD = 100
