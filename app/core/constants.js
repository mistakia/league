/* global IS_DEV */
//= ====================================
//  GENERAL
// -------------------------------------
export const BASE_URL = IS_DEV ? 'http://localhost:8082/api' : 'https://league.io/api'
export const WS_URL = IS_DEV ? 'ws://localhost:8082' : 'ws://league.io'

export const DEFAULT_ORDER_BY = 'vorp.available'

export const TRANSACTIONS_PER_LOAD = 100
