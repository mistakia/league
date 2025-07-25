import fetch from 'node-fetch'

const API_URL =
  'https://registerdisney.go.com/jgc/v5/client/ESPN-FANTASYLM-PROD/api-key?langPref=en-US'
const LOGIN_URL =
  'https://registerdisney.go.com/jgc/v5/client/ESPN-FANTASYLM-PROD/guest/login?langPref=en-US'
const LEAGUES_URL = (swid) =>
  `https://fan.api.espn.com/apis/v2/fans/${swid}?displayEvents=true&displayNow=true&displayRecs=true&recLimit=5&context=fantasy&source=espncom-fantasy&lang=en&section=espn&region=us`

export const get_espn_api_key = async () => {
  const apiKey = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      origin: 'https://cdn.registerdisney.go.com'
    }
  }).then((res) => res.headers.get('api-key'))
  return apiKey
}

export const get_espn_cookies = async ({ username, password }) => {
  const apiKey = await get_espn_api_key()
  const data = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: 'APIKEY ' + apiKey,
      origin: 'https://cdn.registerdisney.go.com'
    },
    body: JSON.stringify({ loginValue: username, password })
  }).then((res) => res.json())

  const { s2 } = data.data
  const { swid } = data.data.profile

  return { s2, swid }
}

export const get_espn_leagues = async (credentials) => {
  const cookies = await get_espn_cookies(credentials)

  const data = await fetch(LEAGUES_URL(cookies.swid)).then((res) => res.json())
  const { preferences } = data
  const leagueIds = preferences
    .filter((p) => p.metaData.entry.abbrev === 'FFL')
    .map((p) => {
      const { entryLocation, entryNickname, groups } = p.metaData.entry
      const name = `${entryLocation} ${entryNickname}`
      const leagueId = groups[0].groupId
      return { name, leagueId }
    })

  return leagueIds
}
