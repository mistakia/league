import debug from 'debug'
import { fetch as fetch_http2 } from 'fetch-h2'

import db from '#db'

const log = debug('yahoo')

export const get_yahoo_config = async () => {
  const config_row = await db('config').where('key', 'yahoo_config').first()
  return config_row.value
}

export const get_yahoo_adp = async () => {
  const yahoo_config = await get_yahoo_config()

  const url = yahoo_config.adp_url
  log(`fetching ${url}`)

  const response = await fetch_http2(url, {
    method: 'GET',
    headers: {
      Accept: '*/*',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'none',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  })

  const data = await response.json()
  return data.fantasy_content.league.players
}
