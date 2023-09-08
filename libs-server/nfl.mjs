import fetch, { FormData } from 'node-fetch'
import debug from 'debug'

import config from '#config'
import { wait } from './wait.mjs'
import * as cache from './cache.mjs'

const log = debug('nfl')
debug.enable('nfl')

export const getToken = async () => {
  const form = new FormData()
  form.set('grant_type', 'client_credentials')
  const data = await fetch(`${config.nfl_api_url}/v1/reroute`, {
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

  if (!token) {
    token = await getToken()
  }

  const url = `${config.nfl_api_url}/experience/v1/games?season=${year}&seasonType=${seas_type}&week=${week}&withExternalIds=true&limit=100`
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

export const getPlays = async ({ id, token, ignore_cache = false }) => {
  const cache_key = `/nfl/plays/${id}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log(`cache hit for nfl plays with id: ${id}`)
      return cache_value
    }
  }

  log(`getting game details for ${id}`)

  if (!token) {
    token = await getToken()
  }

  const query = `
query {
  viewer {
    gameDetail(id: "${id}") {
      attendance
      coinTossWinner {
        abbreviation
      }
      coinTossResults {
        losingChoice
        winningChoice
        winningTeamId
      }
      backJudge
      drives {
        yardsPenalized
        yards
        totalEndedWithScore
        timeOfPossession
        startYardLine
        startTransition
        realStartTime
        quarterStart
        quarterEnd
        endTransition
        endYardLine
        endedWithScore
        firstDowns
        gameClockEnd
        gameClockStart
        howEndedDescription
        howStartedDescription
        inside20
        orderSequence
        playCount
        playIdEnded
        playIdStarted
        playSeqEnded
        playSeqStarted
        possessionTeam {
          abbreviation
          id
        }
        gsisId
      }
      fieldJudge
      fileNumber
      gameInjuries {
        team {
          abbreviation
        }
        returnStatus
        playerName
        playId
        gsisPlayerId
      }
      homeLiveGameRoster {
        status
        lastName
        firstName
        gsisPlayer {
          id
        }
        jerseyNumber
        position
      }
      plays {
        clockTime
        createdDate
        down
        driveNetYards
        drivePlayCount
        driveSequenceNumber
        driveTimeOfPossession
        endClockTime
        endQuarterPlay
        endYardLine
        firstDown
        gameDetailId
        goalToGo
        gsisId
        isBigPlay
        lastModifiedDate
        nextPlayIsGoalToGo
        nextPlayType
        orderSequence
        penaltyOnPlay
        playClock
        playDeleted
        playDescription
        playDescriptionWithJerseyNumbers
        playId
        playReviewStatus
        playType
        prePlayByPlay
        quarter
        scoringPlay
        scoringPlayType
        shortDescription
        specialTeamsPlay
        stPlayType
        timeOfDay
        timeOfDayAsDate
        yardLine
        yards
        yardsToGo
        latestPlay
        playStats {
          playId
          playerName
          statId
          team {
            abbreviation
            id
          }
          gsisPlayer {
            id
            position
            firstName
            lastName
            rookieYear
            birthDate
          }
          playStatSeq
          uniformNumber
          yards
        }
        possessionTeam {
          id
          abbreviation
          nickName
        }
        scoringTeam {
          id
          abbreviation
          nickName
        }
      }
      weather {
        windSpeedMph
        windGustMph
        windDirection
        visibilityMiles
        shortDescription
        observeDate
        lowRealFeelFahrenheit
        lowFahrenheit
        longDescription
        highRealFeelFahrenheit
        highFahrenheit
        location
      }
      visitorTimeoutsUsed
      visitorTeam {
        abbreviation
        id
        fullName
      }
      visitorHeadCoach
      umpire
      startTime
      stadium
      sideJudge
      replayOfficial
      referee
      visitorLiveGameRoster {
        firstName
        gsisPlayer {
          id
        }
        jerseyNumber
        lastName
        position
        status
      }
      headLinesman
      homeHeadCoach
      homePointsTotal
      homePointsOvertime
      homePointsOvertimeTotal
      homePointsQ1
      homePointsQ2
      homePointsQ3
      homePointsQ4
      homeTeam {
        abbreviation
        id
        fullName
      }
      homeTimeoutsRemaining
      homeTimeoutsUsed
      id
      lineJudge
      phase
      playReview
      playReviewPlayId
      visitorPointsOvertime
      visitorPointsOvertimeTotal
      visitorPointsQ1
      visitorPointsQ2
      visitorPointsQ3
      visitorPointsQ4
      visitorPointsTotal
      visitorTimeoutsRemaining
      gameTime
      period
      yardLine
      yardsToGo
      distance
      down
      gameKey
    }
  }
}
  `
  const url = `${config.nfl_api_url}/v3/shield/`
  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    method: 'POST',
    body: JSON.stringify({
      query: `${query}`,
      variables: null
    })
  })

  const data = await res.json()

  if (data && data.data) {
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

  if (!token) {
    token = await getToken()
  }

  const url = `${config.nfl_combine_profiles_url}?year=${year}&limit=1000`
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
