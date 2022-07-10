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
  pid,
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
  const pids = [pid]
  if (release.length) {
    release.forEach((pid) => pids.push(pid))
  }
  const player_rows = await db('player').whereIn('pid', pids)
  const player_row = player_rows.find((p) => p.pid === pid)
  if (!player_row) {
    throw new Error('invalid player')
  }
  if (release.length) {
    for (const release_pid of release) {
      if (!player_rows.some((p) => p.pid === release_pid)) {
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
      pid
    })
    .limit(1)
  if (rosters.length) {
    throw new Error('player is not a free agent')
  }

  // verify player is not locked
  const isLocked = await isPlayerLocked(pid)
  if (isLocked) {
    throw new Error('player is locked, game has started')
  }

  // verify no veterans are signed in the offseason & the rookie draft is complete
  if (!constants.season.isRegularSeason) {
    if (player_row.start !== constants.season.year) {
      throw new Error('veteran free agency not open')
    }

    // verify rookie draft is complete
    const picks = await db('draft').where({
      year: constants.season.year,
      lid: leagueId
    })
    const draftDates = getDraftDates({
      start: league.draft_start,
      type: league.draft_type,
      min: league.draft_hour_min,
      max: league.draft_hour_max,
      picks: picks.length
    })

    if (!league.draft_start || dayjs().isBefore(draftDates.waiverEnd)) {
      throw new Error('rookie free agency not open')
    }
  }

  // verify player is not on waivers - released in the last 24 hours excluding cycling
  const isOnWaivers = await isPlayerOnWaivers({ pid, leagueId })
  if (isOnWaivers) {
    throw new Error('player is on waivers')
  }

  // verify player is practice squad eligible (rookie, not on a team, or on a PS)
  /* if (type === constants.transactions.PRACTICE_ADD) {
   *   if (
   *     player_row.start !== constants.season.year &&
   *     player_row.posd !== 'PS' &&
   *     player_row.cteam !== 'INA'
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
    for (const release_pid of release) {
      const releasePlayer = roster.get(release_pid)
      if (!releasePlayer) {
        continue
        // throw new Error('invalid release')
      }

      if (releasePlayer.slot === constants.slots.PSP) {
        throw new Error('invalid release')
      }

      releasePlayers.push(release_pid)
      roster.removePlayer(release_pid)
    }
  }

  const hasSlot = roster.isEligibleForSlot({ slot, pos: player_row.pos })
  if (!hasSlot) {
    throw new Error('exceeds roster limits')
  }

  const result = []

  // process release
  if (releasePlayers.length) {
    for (const release_pid of releasePlayers) {
      const releaseData = await processRelease({
        release_pid,
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
    pid,
    pos: player_row.pos,
    slot
  })

  // add player transaction
  const addTransaction = {
    userid: userId,
    tid: teamId,
    lid: leagueId,
    pid,
    type,
    value: bid,
    year: constants.season.year,
    waiverid: waiverId,
    timestamp: Math.round(Date.now() / 1000)
  }
  await db('transactions').insert(addTransaction)

  result.push({
    pid,
    slot,
    rid: roster.uid,
    pos: player_row.pos,
    transaction: addTransaction
  })

  // send notification
  let message = `${team.name} (${team.abbrv}) has signed free agent ${player_row.fname} ${player_row.lname} (${player_row.pos}) for $${bid}.`
  if (releasePlayers.length) {
    for (const release_pid of releasePlayers) {
      const release_player_row = player_rows.find((p) => p.pid === release_pid)
      message += ` ${release_player_row.fname} ${release_player_row.lname} (${release_player_row.pos}) has been released.`
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
