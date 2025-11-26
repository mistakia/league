import config from '#config'
import { fetch_with_retry } from './proxy-manager.mjs'

export const set = async ({ key, value }) => {
  const url = `https://xo.football/api/cache${key}`

  const res = await fetch_with_retry(
    url,
    {
      method: 'POST',
      body: JSON.stringify(value),
      headers: {
        authorization: `Bearer ${config.league_api_auth_token}`,
        'Content-Type': 'application/json'
      }
    },
    {
      max_retries: 3,
      use_proxy: false,
      exponential_backoff: true,
      initial_delay: 1000,
      max_delay: 10000
    }
  )
  const data = await res.json()

  return data.value
}

export const get = async ({ key }) => {
  const url = `https://xo.football/api/cache${key}`

  const res = await fetch_with_retry(
    url,
    {},
    {
      max_retries: 3,
      use_proxy: false,
      exponential_backoff: true,
      initial_delay: 1000,
      max_delay: 10000
    }
  )
  const data = await res.json()

  return data.value
}
