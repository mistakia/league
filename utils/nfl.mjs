import fetch from 'node-fetch'
import os from 'os'
import fs from 'fs-extra'
import path from 'path'
import debug from 'debug'

import config from '#config'
import { wait } from './wait.mjs'

const cache_path = path.join(os.homedir(), '/nfl')
const log = debug('nfl')
debug.enable('nfl')

export const getPlayers = async ({ year, token }) => {
  const api_path = `/players/${year}.json`
  const full_path = path.join(cache_path, api_path)
  if (fs.pathExistsSync(full_path)) {
    return fs.readJsonSync(full_path)
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
    const url = `${config.nfl_api_url}/v3/shield/?query=${encodeURIComponent(
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
    fs.ensureFileSync(full_path)
    fs.writeJsonSync(full_path, results, { spaces: 2 })
  }

  return results
}
