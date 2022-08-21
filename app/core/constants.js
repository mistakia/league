/* global IS_DEV */
export const BASE_URL = IS_DEV
  ? 'http://192.168.1.108:8082/api'
  : 'https://teflonleague.com/api'
export const WS_URL = IS_DEV
  ? 'ws://192.168.1.108:8082'
  : 'wss://teflonleague.com'
export const DOCS_URL =
  'https://api.github.com/repos/mistakia/league/contents/docs'

export const TRANSACTIONS_PER_LOAD = 100
