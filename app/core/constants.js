/* global IS_DEV */
//= ====================================
//  GENERAL
// -------------------------------------
export const BASE_URL = IS_DEV ? 'http://localhost:8082/api' : 'https://league.io/api'
export const WS_URL = IS_DEV ? 'ws://localhost:8082' : 'ws://league.io'
