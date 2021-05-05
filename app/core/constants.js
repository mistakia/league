/* global IS_DEV */
//= ====================================
//  GENERAL
// -------------------------------------
export const BASE_URL = IS_DEV ? 'http://localhost:8082/api' : 'https://teflonleague.com/api'
export const WS_URL = IS_DEV ? 'ws://localhost:8082' : 'wss://teflonleague.com'
export const DOCS_URL = 'https://api.github.com/repos/mistakia/league/contents/docs'
export const DEFAULT_LEAGUE_ID = 'DEFAULT_LEAGUE_ID'

export const TRANSACTIONS_PER_LOAD = 100

export const COLUMNS = {
  PLAYER_NAME: 1,
  SEASON_SUMMARY: 2,
  SEASON_PASSING: 3,
  SEASON_RUSHING: 4,
  SEASON_RECEIVING: 5
}
