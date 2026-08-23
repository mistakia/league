import debug from 'debug'

import { fetch_with_retry } from '#libs-server/proxy-manager.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('betonline')
enable_debug_namespaces('betonline')

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
