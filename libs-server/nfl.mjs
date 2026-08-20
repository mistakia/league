import debug from 'debug'

import db from '#db'
import { wait } from './wait.mjs'
import * as cache from './cache.mjs'
import { fetch_with_retry } from './proxy-manager.mjs'

const log = debug('nfl')
// Library module: a bare debug.enable REPLACES the namespace set for the whole
// process, so importing this would silently switch off namespaces the entry
// point enabled. Defer to an explicit DEBUG (see jobs/import-live-odds-worker.mjs).
if (!process.env.DEBUG) {
  debug.enable('nfl')
}

const fetch_json_with_context = async (url, response) => {
  const body = await response.text()

  // Guard non-OK HTTP responses before attempting JSON.parse. Upstream NFL
  // endpoints sit behind Fastly/Varnish, which return HTML error pages (e.g. a
  // 500 "unknown domain" edge error when a backend origin is unmapped, or a 401
  // auth page) on failure. Parsing those throws a misleading
  // "Unexpected token '<'" message; lead with the HTTP status and content-type
  // instead so the real failure is legible. See the 2026-06-20
  // shield-jarvis-api.nfl.com upstream outage.
  if (!response.ok) {
    const content_type = response.headers.get('content-type') || ''
    const snippet = body.replace(/\s+/g, ' ').trim().slice(0, 300)
    throw new Error(
      `nfl fetch HTTP ${response.status} (non-OK) | url=${url} | content-type="${content_type}" | body[0:300]=${snippet}`
    )
  }

  try {
    return JSON.parse(body)
  } catch (err) {
    const snippet = body.slice(0, 500)
    throw new Error(
      `nfl fetch JSON parse failed: ${err.message} | url=${url} | status=${response.status} | body[0:500]=${snippet}`
    )
  }
}

// Endpoints for the PUBLIC NFL API. These were the last two survivors of the
// `nfl_api_config` DB row, which used to conflate endpoints, credentials and
// session state in one jsonb column. A URL is a constant under review in git,
// not rotating state and not a secret; the row now holds NFL Pro session state
// exclusively (see private/libs-server/nfl-pro/session.mjs).
const NFL_API_URL = 'https://api.nfl.com'
const COMBINE_PROFILES_URL = `${NFL_API_URL}/football/v2/combine/profiles`
const NFL_V3_SESSION_URL = `${NFL_API_URL}/identity/v3/token/refresh`
const NFL_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

// The clientKey/clientSecret pair the www.nfl.com SPA embeds. It stays in the
// DB rather than moving to code with the URLs above because it is not ours to
// pin: NFL rotates it when it redeploys the SPA, and the NFL Pro browser
// harvest refreshes the same two fields (private/libs-server/nfl-pro/
// session.mjs). Sharing one stored pair is deliberate -- both callers are
// authenticating as that same SPA client -- but it means this path depends on
// the NFL Pro harvest having run at least once.
const get_nfl_client_credentials = async () => {
  const row = await db('config').where({ key: 'nfl_api_config' }).first()
  const { client_key, client_secret } = row?.config_value || {}
  if (!client_key || !client_secret) {
    throw new Error(
      'nfl_api_config carries no client_key/client_secret; run the NFL Pro ' +
        'browser harvest (nfl_pro.get_session_token) to populate them'
    )
  }
  return { client_key, client_secret }
}

export const generate_guid = () => {
  let e = new Date().getTime()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (x) {
    const r = ((e + 16 * Math.random()) % 16) | 0
    e = Math.floor(e / 16)
    return (x === 'x' ? r : (3 & r) | 8).toString(16)
  })
}

export const get_session_token_v3 = async () => {
  const device_id = generate_guid()
  const refresh_token = generate_guid()

  const { client_key, client_secret } = await get_nfl_client_credentials()

  const form = new FormData()
  form.set('clientKey', client_key)
  form.set('clientSecret', client_secret)
  form.set('deviceId', device_id)
  form.set('deviceInfo', '')
  form.set('refreshToken', refresh_token)
  form.set('networkType', 'wifi')
  form.set('nflClaimGroupsToAdd', '[]')
  form.set('nflClaimGroupsToRemove', '[]')

  const response = await fetch_with_retry({
    url: NFL_V3_SESSION_URL,
    method: 'POST',
    body: form,
    headers: {
      origin: 'https://www.nfl.com',
      referer: 'https://www.nfl.com/',
      'User-Agent': NFL_USER_AGENT
    },
    use_proxy: true
  })

  const data = await fetch_json_with_context(NFL_V3_SESSION_URL, response)
  log(data)
  return data.accessToken
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

  const api_url = NFL_API_URL

  if (!token) {
    token = await get_session_token_v3()
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
    const res = await fetch_with_retry({
      url,
      headers: {
        authorization: `Bearer ${token}`
      },
      use_proxy: true
    })
    data = await fetch_json_with_context(url, res)

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

  const api_url = NFL_API_URL

  if (!token) {
    token = await get_session_token_v3()
  }

  const url = `${api_url}/experience/v1/games?season=${year}&seasonType=${seas_type}&week=${week}&withExternalIds=true&limit=100`
  log(url)
  const res = await fetch_with_retry({
    url,
    headers: {
      authorization: `Bearer ${token}`
    },
    use_proxy: true
  })

  const data = await fetch_json_with_context(url, res)

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

  const api_url = NFL_API_URL

  log(`getting game details for ${id}`)
  if (!token) {
    token = await get_session_token_v3()
  }

  const url = `${api_url}/experience/v1/gamedetails/${id}?withExternalIds`
  const res = await fetch_with_retry({
    url,
    headers: {
      authorization: `Bearer ${token}`
    },
    use_proxy: true
  })

  const data = await fetch_json_with_context(url, res)

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

  const combine_profiles_url = COMBINE_PROFILES_URL

  if (!token) {
    token = await get_session_token_v3()
  }

  const url = `${combine_profiles_url}?year=${year}&limit=1000`
  log(url)
  const res = await fetch_with_retry({
    url,
    headers: {
      authorization: `Bearer ${token}`
    },
    use_proxy: true
  })
  const data = await fetch_json_with_context(url, res)

  if (res.ok) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}
