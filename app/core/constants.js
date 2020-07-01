/* global IS_DEV */
//= ====================================
//  GENERAL
// -------------------------------------
export const BASE_URL = IS_DEV ? 'http://localhost:8082/api' : 'https://teflonleague.com/api'
export const WS_URL = IS_DEV ? 'ws://localhost:8082' : 'wss://teflonleague.com'

export const TRANSACTIONS_PER_LOAD = 100
