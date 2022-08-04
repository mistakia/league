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

export const getGames = async ({ year, week, seas_type, token }) => {
  const api_path = `/games/${year}/${seas_type}/${week}.json`
  const full_path = path.join(cache_path, api_path)
  if (fs.pathExistsSync(full_path)) {
    return fs.readJsonSync(full_path)
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
    fs.ensureFileSync(full_path)
    fs.writeJsonSync(full_path, data, { spaces: 2 })
  }

  return data
}

export const getPlays = async ({ id, token, bypass_cache = false }) => {
  const api_path = `/plays/${id}.json`
  const full_path = path.join(cache_path, api_path)
  if (!bypass_cache && fs.pathExistsSync(full_path)) {
    return fs.readJsonSync(full_path)
  }

  log(`getting game details for ${id}`)

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
            displayName
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
  const url = `${config.nfl_api_url}/v3/shield/?query=${encodeURIComponent(
    query
  )}&variables=null`
  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`
    }
  })

  const data = await res.json()

  if (data && data.games.length) {
    fs.ensureFileSync(full_path)
    fs.writeJsonSync(full_path, data, { spaces: 2 })
  }

  return data
}
