import fetch, { FormData } from 'node-fetch'
import debug from 'debug'

import db from '#db'
import { wait } from './wait.mjs'
import * as cache from './cache.mjs'

const log = debug('nfl')
debug.enable('nfl')

// Cached config from database
let nfl_api_config_cache = null

export const get_nfl_api_config = async () => {
  if (nfl_api_config_cache) {
    return nfl_api_config_cache
  }

  const config_row = await db('config').where({ key: 'nfl_api_config' }).first()
  if (!config_row?.value) {
    throw new Error('nfl_api_config not found in database config table')
  }

  nfl_api_config_cache = config_row.value
  return nfl_api_config_cache
}

export const generate_guid = () => {
  let e = new Date().getTime()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (x) {
    const r = (e + 16 * Math.random()) % 16 | 0
    e = Math.floor(e / 16)
    return (x === 'x' ? r : (3 & r) | 8).toString(16)
  })
}

export const get_session_token_v3 = async () => {
  const device_id = generate_guid()
  const refresh_token = generate_guid()

  const nfl_config = await get_nfl_api_config()
  log(nfl_config)
  const { client_key, client_secret, session_url, user_agent } = nfl_config

  const form = new FormData()
  form.set('clientKey', client_key)
  form.set('clientSecret', client_secret)
  form.set('deviceId', device_id)
  form.set('deviceInfo', '')
  form.set('refreshToken', refresh_token)
  form.set('networkType', 'wifi')
  form.set('nflClaimGroupsToAdd', '[]')
  form.set('nflClaimGroupsToRemove', '[]')

  const response = await fetch(session_url, {
    method: 'POST',
    body: form,
    headers: {
      origin: 'https://www.nfl.com',
      referer: 'https://www.nfl.com/',
      'User-Agent': user_agent
    }
  })

  const data = await response.json()
  log(data)
  return data.accessToken
}

export const getToken = async () => {
  const nfl_config = await get_nfl_api_config()
  const api_url = nfl_config.api_url

  const form = new FormData()
  form.set('grant_type', 'client_credentials')
  const data = await fetch(`${api_url}/v1/reroute`, {
    method: 'POST',
    body: form,
    headers: {
      origin: 'https://www.nfl.com',
      referer: 'https://www.nfl.com/scores/',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36',
      'x-domain-id': '100'
    }
  }).then((res) => res.json())

  return data.access_token
}

export const getPlayers = async ({ year, token, ignore_cache = false }) => {
  const cache_key = `/nfl/players/${year}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log(`cache hit for nfl players with year: ${year}`)
      return cache_value
    }
  }

  const nfl_config = await get_nfl_api_config()
  const api_url = nfl_config.api_url

  if (!token) {
    token = await getToken()
  }

  let results = []
  let after = null
  let data

  do {
    const query = `
query {
  viewer {
    players(season_season: ${year}, first: 500, after: "${after}") {
      edges {
        node {
          person {
            displayName
            birthCity
            birthCountry
            birthDate
            birthDay
            birthMonth
            birthStateProv
            birthYear
            collegeName
            currentProfile
            draftNumberOverall
            draftPlayerPosition
            draftPosition
            draftRound
            draftType
            draftYear
            eliasHomeCountry
            esbId
            firstName
            gsisId
            highSchool
            hometown
            id
            lastName
            middleName
            nickName
            socials {
              label
              link
              platform
            }
            status
            suffix
          }
          currentTeam {
            abbreviation
          }
          esbId
          gsisId
          height
          id
          jerseyNumber
          weight
          status
          positionGroup
          position
          nflExperience
        }
      }
      pageInfo {
        hasNextPage
        total
        endCursor
      }
    }
  }
}
`
    const url = `${api_url}/v3/shield/?query=${encodeURIComponent(
      query
    )}&variables=null`
    log(`fetching nfl players for year: ${year}, after: ${after}`)
    const res = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`
      }
    })
    data = await res.json()

    if (data && data.data) {
      after = data.data.viewer.players.pageInfo.endCursor
      results = results.concat(data.data.viewer.players.edges)
    } else {
      log(data)
    }

    await wait(4000)
  } while (data && data.data && data.data.viewer.players.pageInfo.hasNextPage)

  if (results.length) {
    await cache.set({ key: cache_key, value: results })
  }

  return results
}

export const getGames = async ({
  year,
  week,
  seas_type,
  token,
  ignore_cache
}) => {
  const cache_key = `/nfl/games/${year}/${seas_type}/${week}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log(
        `cache hit for nfl games with year: ${year}, week: ${week}, seas_type: ${seas_type}`
      )
      return cache_value
    }
  }

  const nfl_config = await get_nfl_api_config()
  const api_url = nfl_config.api_url

  if (!token) {
    token = await get_session_token_v3()
  }

  const url = `${api_url}/experience/v1/games?season=${year}&seasonType=${seas_type}&week=${week}&withExternalIds=true&limit=100`
  log(url)
  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`
    }
  })

  const data = await res.json()

  if (data && data.games.length) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}

export const get_plays_v1 = async ({ id, token, ignore_cache = false }) => {
  const cache_key = `/nfl_v1/plays/${id}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log(`cache hit for nfl plays with id: ${id}`)
      return cache_value
    }
  }

  const nfl_config = await get_nfl_api_config()
  const api_url = nfl_config.api_url

  log(`getting game details for ${id}`)
  if (!token) {
    token = await get_session_token_v3()
  }

  const url = `${api_url}/experience/v1/gamedetails/${id}?withExternalIds`
  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`
    }
  })

  const data = await res.json()

  if (
    data &&
    data.data &&
    data.data.viewer &&
    data.data.viewer.gameDetail &&
    data.data.viewer.gameDetail.id
  ) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}

export const get_combine_profiles = async ({
  ignore_cache = false,
  year,
  token
} = {}) => {
  const cache_key = `/nfl/combine_profiles/${year}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log(`cache hit for nfl combine profiles with year: ${year}`)
      return cache_value
    }
  }

  const nfl_config = await get_nfl_api_config()
  const combine_profiles_url = nfl_config.combine_profiles_url

  if (!token) {
    token = await get_session_token_v3()
  }

  const url = `${combine_profiles_url}?year=${year}&limit=1000`
  log(url)
  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`
    }
  })
  const data = await res.json()

  if (res.ok) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}
