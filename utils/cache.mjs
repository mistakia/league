import config from '#config'
import fetch from 'node-fetch'

export const set = async ({ key, value }) => {
  const url = `https://xo.football/api/cache${key}`
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(value),
    headers: {
      authorization: `Bearer ${config.league_api_auth_token}`
    }
  })
  const data = await res.json()

  return data.value
}

export const get = async ({ key }) => {
  const url = `https://xo.football/api/cache${key}`
  const res = await fetch(url)
  const data = await res.json()

  return data.value
}
