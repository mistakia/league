import fetch from 'node-fetch'
import debug from 'debug'

const log = debug('betonline')
debug.enable('betonline')

const DIGITAL_SPORTS_TECH_API_URL = 'https://bv2.digitalsportstech.com/api'

export const market_groups = [
  'Defense',
  'First Touchdown Scorer',
  'Passing',
  'Receiving',
  'Rushing',
  'Touchdowns'
]

export const get_market_groups = async () => {
  const url = `${DIGITAL_SPORTS_TECH_API_URL}/grouped-markets/v2/map?sb=betonline&sgmOdds=true&league=nfl`
  log(url)
  const res = await fetch(url)
  const data = await res.json()

  return data
}

export const get_events = async () => {
  const url = `${DIGITAL_SPORTS_TECH_API_URL}/gfm/gamesByGfm?sb=betonline&league=nfl&sgmOdds=true`
  log(url)
  const res = await fetch(url)
  const data = await res.json()

  return data
}

export const get_markets = async ({ statistic, gameId }) => {
  const url = `${DIGITAL_SPORTS_TECH_API_URL}/dfm/marketsBySs?sb=betonline&gameId=${gameId}&statistic=${statistic}`
  log(url)
  const res = await fetch(url)
  const data = await res.json()

  return data
}
