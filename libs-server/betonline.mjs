import fetch from 'node-fetch'
import debug from 'debug'

import config from '#config'

const log = debug('betonline')
debug.enable('betonline')

export const market_groups = [
  'Defense',
  'First Touchdown Scorer',
  'Passing',
  'Receiving',
  'Rushing',
  'Touchdowns'
]

export const get_market_groups = async () => {
  const url = `${config.digital_sports_tech_api_url}/grouped-markets/v2/map?sb=betonline&sgmOdds=true&league=nfl`
  log(url)
  const res = await fetch(url)
  const data = await res.json()

  return data
}

export const get_events = async () => {
  const url = `${config.digital_sports_tech_api_url}/gfm/gamesByGfm?sb=betonline&league=nfl&sgmOdds=true`
  log(url)
  const res = await fetch(url)
  const data = await res.json()

  return data
}

export const get_markets = async ({ statistic, gameId }) => {
  const url = `${config.digital_sports_tech_api_url}/dfm/marketsBySs?sb=betonline&gameId=${gameId}&statistic=${statistic}`
  log(url)
  const res = await fetch(url)
  const data = await res.json()

  return data
}
