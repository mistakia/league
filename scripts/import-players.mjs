import fetch from 'node-fetch'
import debug from 'debug'

import {
  is_main,
  find_player_row,
  wait,
  updatePlayer,
  nfl,
  report_job
} from '#libs-server'
import { fixTeam } from '#libs-shared'
import { current_season } from '#constants'
import { job_types } from '#libs-shared/job-constants.mjs'
import { NFL_API_URL } from '#libs-server/nfl.mjs'

const log = debug('import:nfl:players')
debug.enable('import:nfl:players,get-player,update-player')

const run = async () => {
  const missing = []
  const token = await nfl.getToken()

  log('fetching team ids')
  // get team ids
  const data = await fetch(
    `${NFL_API_URL}/v1/teams?s=%7B%22%24query%22%3A%7B%22season%22%3A2020%7D,%22%24take%22%3A40%7D&fs=%7Bid,season,fullName,nickName,abbr,teamType,conference%7Babbr%7D,division%7Babbr%7D%7D`,
    {
      headers: {
        authorization: `Bearer ${token}`
      }
    }
  ).then((res) => res.json())

  const teams = data.data.filter((t) => t.teamType === 'TEAM')
  // iterate through each team and update players
  for (const team of teams) {
    const { id } = team

    const s = encodeURIComponent(
      `{"$query":{"season":${current_season.year}, "week": ${current_season.week}}}`
    )
    const fs = encodeURIComponent(
      '{id,season,fullName,nickName,abbr,teamType,roster{ week, id,firstName,lastName,displayName,birthDate,gsisId,esbId},depthChart{person{id,firstName,lastName},unit,depthOrder,positionAbbr},injuries{id,type,person{firstName,lastName,id},injury,injuryStatus,practice,practiceStatus,status}}'
    )
    const url = `${NFL_API_URL}/v1/teams/${id}?s=${s}&fs=${fs}`
    log(url)
    const rosterData = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`
      }
    }).then((res) => res.json())

    // iterate through players and make updates
    for (const item of rosterData.roster.data) {
      const teamAbbr = fixTeam(rosterData.abbr)

      const name = `${item.firstName} ${item.lastName}`
      const player_row = await find_player_row({ name, team: teamAbbr })

      if (!player_row) {
        missing.push(item)
        continue
      }

      if (item.gsisId || item.esbId) {
        const update = {}

        if (item.gsisId) {
          update.gsisid = item.gsisId
        }

        if (item.esbId) {
          update.esbid = item.esbId
        }

        await updatePlayer({ player_row, update })
      }
    }

    await wait(5000)
  }

  for (const item of missing) {
    log(item)
  }
}

const main = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.NFL_PLAYERS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
