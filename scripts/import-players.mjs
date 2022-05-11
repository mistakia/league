import fetch from 'node-fetch'
import debug from 'debug'

import db from '#db'
import { getToken, getPlayer, wait } from '#utils'
import { constants, fixTeam } from '#common'

const log = debug('import:nfl:players')
debug.enable('import:nfl:players')

const run = async () => {
  const missing = []
  const token = await getToken()

  log('fetching team ids')
  // get team ids
  const data = await fetch(
    'https://api.nfl.com/v1/teams?s=%7B%22%24query%22%3A%7B%22season%22%3A2020%7D,%22%24take%22%3A40%7D&fs=%7Bid,season,fullName,nickName,abbr,teamType,conference%7Babbr%7D,division%7Babbr%7D%7D',
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
      `{"$query":{"season":${constants.season.year}, "week": ${constants.season.week}}}`
    )
    const fs = encodeURIComponent(
      '{id,season,fullName,nickName,abbr,teamType,roster{ week, id,firstName,lastName,displayName,birthDate,gsisId,esbId},depthChart{person{id,firstName,lastName},unit,depthOrder,positionAbbr},injuries{id,type,person{firstName,lastName,id},injury,injuryStatus,practice,practiceStatus,status}}'
    )
    const url = `https://api.nfl.com/v1/teams/${id}?s=${s}&fs=${fs}`
    log(url)
    const rosterData = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`
      }
    }).then((res) => res.json())

    // iterate through players and make updates
    const timestamp = Math.round(Date.now() / 1000)
    for (const item of rosterData.roster.data) {
      const teamAbbr = fixTeam(rosterData.abbr)

      const name = `${item.firstName} ${item.lastName}`
      const player = await getPlayer({ name, team: teamAbbr })

      if (!player) {
        missing.push(player)
        continue
      }
      const players = await db('player')
        .where({ player: player.player })
        .limit(1)
      const currentPlayer = players[0]

      if (player.gsisId && player.gsisId !== currentPlayer.gsisid) {
        await db('player_changelog').insert({
          type: constants.changes.PLAYER_EDIT,
          id: player.player,
          prop: 'gsisid',
          prev: currentPlayer.gsisid,
          new: player.gsisId,
          timestamp
        })

        await db('player')
          .update({
            gsisid: player.gsisId
          })
          .where({ player: player.player })
      }

      if (player.esbId && player.esbId !== currentPlayer.esbid) {
        await db('player_changelog').insert({
          type: constants.changes.PLAYER_EDIT,
          id: player.player,
          prop: 'esbid',
          prev: currentPlayer.esbid,
          new: player.esbId,
          timestamp
        })

        await db('player')
          .update({
            esbid: player.esbId
          })
          .where({ player: player.player })
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

  await db('jobs').insert({
    type: constants.jobs.NFL_PLAYERS,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default run
