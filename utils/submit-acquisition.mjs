import dayjs from 'dayjs'

import db from '#db'
import { constants, Roster, getDraftDates } from '#common'
import sendNotifications from './send-notifications.mjs'
import getRoster from './get-roster.mjs'
import isPlayerOnWaivers from './is-player-on-waivers.mjs'
import processRelease from './process-release.mjs'
import isPlayerLocked from './is-player-locked.mjs'
import getLeague from './get-league.mjs'

export default async function ({
  leagueId,
  release = [],
  player,
  teamId,
  bid = 0,
  userId,
  slot = constants.slots.BENCH,
  waiverId
}) {
  const type =
    slot === constants.slots.BENCH
      ? constants.transactions.ROSTER_ADD
      : constants.transactions.PRACTICE_ADD

  // verify player and release ids
  const playerIds = [player]
  if (release.length) {
    release.forEach((player) => playerIds.push(player))
  }
  const playerRows = await db('player').whereIn('player', playerIds)
  const playerRow = playerRows.find((p) => p.player === player)
  if (!playerRow) {
    throw new Error('invalid player')
  }
  if (release.length) {
    for (const player of release) {
      if (!playerRows.some((p) => p.player === player)) {
        throw new Error('invalid release')
      }
    }
  }

  // verify leagueId
  const league = await getLeague(leagueId)
  if (!league) {
    throw new Error('invalid leagueId')
  }

  const teams = await db('teams').where({ uid: teamId }).limit(1)
  const team = teams[0]

  if (team.faab - bid < 0) {
    throw new Error('exceeds available free agent auction budget')
  }

  // verify player is a free agent
  const rosters = await db('rosters_players')
    .join('rosters', 'rosters_players.rid', 'rosters.uid')
    .where({
      lid: leagueId,
      week: constants.season.week,
      year: constants.season.year,
      player
    })
    .limit(1)
  if (rosters.length) {
    throw new Error('player is not a free agent')
  }

  // verify player is not locked
  const isLocked = await isPlayerLocked(player)
  if (isLocked) {
    throw new Error('player is locked, game has started')
  }

  // verify no veterans are signed in the offseason & the rookie draft is complete
  if (!constants.season.isRegularSeason) {
    if (playerRow.start !== constants.season.year) {
      throw new Error('veteran free agency not open')
    }

    // verify rookie draft is complete
    const picks = await db('draft').where({
      year: constants.season.year,
      lid: leagueId
    })
    const draftDates = getDraftDates({
      start: league.ddate,
      picks: picks.length
    })

    if (!league.ddate || dayjs().isBefore(draftDates.waiverEnd)) {
      throw new Error('rookie free agency not open')
    }
  }

  // verify player is not on waivers - released in the last 24 hours excluding cycling
  const isOnWaivers = await isPlayerOnWaivers({ player, leagueId })
  if (isOnWaivers) {
    throw new Error('player is on waivers')
  }

  // verify player is practice squad eligible (rookie, not on a team, or on a PS)
  /* if (type === constants.transactions.PRACTICE_ADD) {
   *   if (
   *     playerRow.start !== constants.season.year &&
   *     playerRow.posd !== 'PS' &&
   *     playerRow.cteam !== 'INA'
   *   ) {
   *     throw new Error('player is not practice squad eligible')
   *   }
   * }
   */

  // verify team has bench space & passes roster constraints
  const rosterRow = await getRoster({ tid: teamId })
  const roster = new Roster({ roster: rosterRow, league })
  const releasePlayers = []
  if (release.length) {
    for (const player of release) {
      const releasePlayer = roster.get(player)
      if (!releasePlayer) {
        continue
        // throw new Error('invalid release')
      }

      if (releasePlayer.slot === constants.slots.PSP) {
        throw new Error('invalid release')
      }

      releasePlayers.push(player)
      roster.removePlayer(player)
    }
  }

  const hasSlot = roster.isEligibleForSlot({ slot, player, pos: playerRow.pos })
  if (!hasSlot) {
    throw new Error('exceeds roster limits')
  }

  const result = []

  // process release
  if (releasePlayers.length) {
    for (const player of releasePlayers) {
      const releaseData = await processRelease({
        player,
        tid: teamId,
        lid: leagueId,
        userid: userId
      })
      result.push(releaseData[0])
    }
  }

  // add player to roster
  await db('rosters_players').insert({
    rid: roster.uid,
    player,
    pos: playerRow.pos,
    slot
  })

  // add player transaction
  const addTransaction = {
    userid: userId,
    tid: teamId,
    lid: leagueId,
    player,
    type,
    value: bid,
    year: constants.season.year,
    waiverid: waiverId,
    timestamp: Math.round(Date.now() / 1000)
  }
  await db('transactions').insert(addTransaction)

  result.push({
    player,
    slot,
    rid: roster.uid,
    pos: playerRow.pos,
    transaction: addTransaction
  })

  // send notification
  let message = `${team.name} (${team.abbrv}) has signed free agent ${playerRow.fname} ${playerRow.lname} (${playerRow.pos}) for $${bid}.`
  if (releasePlayers.length) {
    for (const player of releasePlayers) {
      const releasePlayer = playerRows.find((p) => p.player === player)
      message += ` ${releasePlayer.fname} ${releasePlayer.lname} (${releasePlayer.pos}) has been released.`
    }
  }

  await sendNotifications({
    league,
    teamIds: [],
    voice: false,
    notifyLeague: true,
    message
  })

  return result
}
