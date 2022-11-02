import fetch from 'node-fetch'
import debug from 'debug'

import config from '#config'
import { constants } from '#common'

const log = debug('prizepicks')
debug.enable('prizepicks')

export const stats = {
  // 'Pass+Rush+Rec TDs'
  'Pass Yards': constants.player_prop_types.GAME_PASSING_YARDS,
  'Rush Yards': constants.player_prop_types.GAME_RUSHING_YARDS,
  'Receiving Yards': constants.player_prop_types.GAME_RECEIVING_YARDS
}

export const getPlayerProps = async ({ page = 1 }) => {
  const url = `${config.prizepicks_api_url}/projections?league_id=9&per_page=250&single_stat=true&page=${page}`

  log(`fetching ${url}`)
  const res = await fetch(url)
  const data = await res.json()

  return data
}
