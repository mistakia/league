import debug from 'debug'

import db from '#db'
import { player_prop_types } from '#libs-shared/bookmaker-constants.mjs'
import { puppeteer, wait } from '#libs-server'

const log = debug('betmgm')
debug.enable('betmgm')

export const markets = {
  12203: player_prop_types.GAME_PASSING_COMPLETIONS,
  12205: player_prop_types.GAME_RECEPTIONS,
  12280: player_prop_types.GAME_PASSING_ATTEMPTS,
  14923: player_prop_types.GAME_RUSHING_ATTEMPTS,
  14925: player_prop_types.GAME_LONGEST_RECEPTION,
  23262: player_prop_types.GAME_TACKLES_ASSISTS,
  27589: player_prop_types.GAME_PASSING_YARDS,
  27590: player_prop_types.GAME_RECEIVING_YARDS,
  27591: player_prop_types.GAME_RUSHING_YARDS,
  31919: player_prop_types.GAME_PASSING_INTERCEPTIONS,
  33712: player_prop_types.GAME_PASSING_TOUCHDOWNS,
  33715: player_prop_types.GAME_RUSHING_RECEIVING_YARDS,
  33743: player_prop_types.GAME_PASSING_LONGEST_COMPLETION,
  // 33744: kicker points
  // 33745: extra points
  // 33746: field goals
  // 34345: passing and rushing yards
  34346: player_prop_types.GAME_LONGEST_RUSH
}

const get_betmgm_config = async () => {
  const config_row = await db('config').where({ key: 'betmgm_config' }).first()
  return config_row.value
}

export const get_markets = async () => {
  const betmgm_config = await get_betmgm_config()

  const { page, browser } = await puppeteer.getPage(
    'https://sports.md.betmgm.com/en/sports/football-11/betting/usa-9/nfl-35'
  )
  const market_data_url = `${betmgm_config.api_url}/bettingoffer/fixtures?x-bwin-accessid=YmNkZjhiMzEtYWIwYS00ZDg1LWE2MWYtOGMyYjljNTdjYjFl&country=US&lang=en-us&offerMapping=All&sportIds=11&competitionIds=35`
  log(`fetching ${market_data_url}`)
  await wait(2000)
  const response = await page.goto(market_data_url)
  const data = await response.json()
  await browser.close()

  if (!data || !data.fixtures || !data.fixtures.length) {
    return { fixtures: [] }
  }

  return { fixtures: data.fixtures }
}
