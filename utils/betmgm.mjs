import fetch from 'node-fetch'
// import debug from 'debug'

import config from '#config'
import { constants } from '#common'

// const log = debug('betmgm')
// debug.enable('betmgm')

export const markets = {
  12203: constants.player_prop_types.GAME_PASSING_COMPLETIONS,
  12205: constants.player_prop_types.GAME_RECEPTIONS,
  12280: constants.player_prop_types.GAME_PASSING_ATTEMPTS,
  14923: constants.player_prop_types.GAME_RUSHING_ATTEMPTS,
  14925: constants.player_prop_types.GAME_LONGEST_RECEPTION,
  23262: constants.player_prop_types.GAME_TACKLES_ASSISTS,
  27589: constants.player_prop_types.GAME_PASSING_YARDS,
  27590: constants.player_prop_types.GAME_RECEIVING_YARDS,
  27591: constants.player_prop_types.GAME_RUSHING_YARDS,
  31919: constants.player_prop_types.GAME_PASSING_INTERCEPTIONS,
  33712: constants.player_prop_types.GAME_PASSING_TOUCHDOWNS,
  33715: constants.player_prop_types.GAME_RUSHING_RECEIVING_YARDS,
  33743: constants.player_prop_types.GAME_PASSING_LONGEST_COMPLETION,
  // 33744: kicker points
  // 33745: extra points
  // 33746: field goals
  // 34345: passing and rushing yards
  34346: constants.player_prop_types.GAME_LONGEST_RUSH
}

export const get_markets = async () => {
  const url = `${config.betmgm_api_url}/bettingoffer/fixtures?x-bwin-accessid=YmNkZjhiMzEtYWIwYS00ZDg1LWE2MWYtOGMyYjljNTdjYjFl&sportIds=11&competitionIds=35&country=US&lang=en-us&offerMapping=All`

  // log(`fetching ${url}`)
  const res = await fetch(url)
  const data = await res.json()

  if (!data || !data.fixtures || !data.fixtures.length) {
    return { nfl_game_markets: [], all_markets: [] }
  }

  // filter out non-game fixtures
  const filtered_fixtures = data.fixtures.filter((f) => f.participants.length)

  // filter to supported markets
  const nfl_game_markets = filtered_fixtures
    .map((f) => f.games)
    .flat()
    .filter((g) => g.categoryId === 518 && markets[g.templateId])

  const all_markets = data.fixtures.map((f) => f.games).flat()

  return { nfl_game_markets, all_markets }
}
