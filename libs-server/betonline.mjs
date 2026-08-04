import debug from 'debug'

import { fetch_with_retry } from '#libs-server/proxy-manager.mjs'

const log = debug('betonline')
// Library module: a bare debug.enable REPLACES the namespace set for the whole
// process, so importing this would silently switch off namespaces the entry
// point enabled. Defer to an explicit DEBUG (see jobs/import-live-odds-worker.mjs).
if (!process.env.DEBUG) {
  debug.enable('betonline')
}

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
  const data = await fetch_with_retry({
    url,
    use_proxy: true,
    response_type: 'json'
  })

  return data
}

export const get_events = async () => {
  const url = `${DIGITAL_SPORTS_TECH_API_URL}/gfm/gamesByGfm?sb=betonline&league=nfl&sgmOdds=true`
  log(url)
  const data = await fetch_with_retry({
    url,
    use_proxy: true,
    response_type: 'json'
  })

  return data
}

export const get_markets = async ({ statistic, gameId }) => {
  const url = `${DIGITAL_SPORTS_TECH_API_URL}/dfm/marketsBySs?sb=betonline&gameId=${gameId}&statistic=${statistic}`
  log(url)
  const data = await fetch_with_retry({
    url,
    use_proxy: true,
    response_type: 'json'
  })

  return data
}
