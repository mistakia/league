import dayjs from 'dayjs'
import advancedFormat from 'dayjs/plugin/advancedFormat.js'

import db from '#db'

import {
  constants,
  Roster,
  isSantuaryPeriod,
  getPoachProcessingTime
} from '#libs-shared'
import sendNotifications from './send-notifications.mjs'
import getRoster from './get-roster.mjs'
import getLeague from './get-league.mjs'

dayjs.extend(advancedFormat)

export default async function ({
  leagueId,
  release = [],
  pid,
  teamId,
  team,
  userId,
  is_waiver = false
}) {
  // verify player and release ids
  const pids = [pid]
  if (release.length) {
    release.forEach((pid) => pids.push(pid))
  }
  const player_rows = await db('player').whereIn('pid', pids)
  if (player_rows.length !== pids.length) {
    throw new Error('could not find playerIds')
  }
  const poachPlayer = player_rows.find((p) => p.pid === pid)

  // verify leagueId
  const league = await getLeague({ lid: leagueId })
  if (!league) {
    throw new Error('invalid leagueId')
  }

  // verify player is on a practice squad
  const slots = await db('rosters_players')
    .where({
      lid: leagueId,
      week: constants.season.week,
      year: constants.season.year,
      pid
    })
    .where(function () {
      this.where({
        slot: constants.slots.PS
      }).orWhere({
        slot: constants.slots.PSD
      })
    })
  if (!slots.length) {
    throw new Error('player is not in an unprotected practice squad slot')
  }
  const playerTid = slots[0].tid

  // if it is not a waiver, make sure no other waivers are pending
  if (!is_waiver) {
    const existing_waivers = await db('waivers')
      .where({
        pid,
        lid: leagueId,
        type: constants.waivers.POACH
      })
      .whereNull('processed')
      .whereNull('cancelled')

    if (existing_waivers.length) {
      throw new Error('player has existing poaching claim')
    }
  }

  // verify no existing poaches exist
  const poaches = await db('poaches').where({ pid }).whereNull('processed')
  if (poaches.length) {
    throw new Error('player has existing poaching claim')
  }

  // verify poaching team roster has bench space
  const rosterRow = await getRoster({ tid: teamId })
  const roster = new Roster({ roster: rosterRow, league })
  if (release.length) {
    for (const release_pid of release) {
      if (!roster.has(release_pid)) {
        throw new Error('invalid release player, not on roster')
      }
      roster.removePlayer(release_pid)
    }
  }
  const hasSlot = roster.has_bench_space_for_position(poachPlayer.pos)
  if (!hasSlot) {
    throw new Error('poaching claim unsuccessful, no available roster space')
  }

  // verify it is not Regular Season or Free Agency Sanctuary Period
  if (isSantuaryPeriod(league)) {
    throw new Error('Santuary period')
  }

  // verify team has enough cap if during the offseason
  const transactions = await db('transactions')
    .where({ pid, lid: leagueId })
    .orderBy('timestamp', 'desc')
    .orderBy('uid', 'desc')
    .limit(1)
  const tran = transactions[0]
  const playerPoachValue = tran.value + 2
  if (
    !constants.season.isRegularSeason &&
    roster.availableCap - playerPoachValue < 0
  ) {
    throw new Error('not enough available cap')
  }

  // TODO - verify team does not have any tied up cap in a pending poach

  // verify release player is not used in a pending poach
  if (release.length) {
    const pendingPoachReleases = await db('poach_releases')
      .select('poach_releases.pid')
      .join('poaches', 'poach_releases.poachid', 'poaches.uid')
      .whereNull('processed')
      .where('tid', teamId)
    const pendingPoachReleasePlayers = pendingPoachReleases.map((p) => p.pid)
    for (const release_pid of release) {
      if (pendingPoachReleasePlayers.includes(release_pid)) {
        throw new Error('release player used in another poach')
      }
    }
  }

  const submitted = Math.round(Date.now() / 1000)
  const data = {
    userid: userId,
    tid: teamId,
    lid: leagueId,
    player_tid: playerTid,
    pid,
    submitted
  }
  const insert_query = await db('poaches').insert(data).returning('uid')
  const poachid = insert_query[0].uid
  const releaseInserts = release.map((pid) => ({ poachid, pid }))
  if (releaseInserts.length) {
    await db('poach_releases').insert(releaseInserts)
  }

  const player_team = await db('teams')
    .where({
      uid: playerTid,
      year: constants.season.year,
      lid: leagueId
    })
    .first()
  const processing_time = getPoachProcessingTime(submitted)
  const message = `${team.name} has submitted a poaching claim for ${
    poachPlayer.fname
  } ${poachPlayer.lname} (${poachPlayer.pos}) on ${
    player_team.name
  }. This claim will be processed around ${processing_time.format(
    'dddd, MMMM Do h:mm a'
  )} EST.`
  await sendNotifications({
    league,
    teamIds: [],
    voice: true,
    notifyLeague: true,
    message
  })

  return {
    uid: poachid,
    release,
    ...data
  }
}
