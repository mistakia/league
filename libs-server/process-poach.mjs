import db from '#db'
import { constants, Roster } from '#libs-shared'
import sendNotifications from './send-notifications.mjs'
import getRoster from './get-roster.mjs'
import processRelease from './process-release.mjs'
import getLeague from './get-league.mjs'
import createConditionalPick from './create-conditional-pick.mjs'
import getLastTransaction from './get-last-transaction.mjs'

export default async function ({ pid, release = [], lid, tid, userid }) {
  const rosterSlots = await db('rosters_players')
    .where('rosters_players.pid', pid)
    .where({ week: constants.season.week, year: constants.season.year, lid })

  // verify player is on a team
  if (!rosterSlots.length) {
    throw new Error('player not on a roster')
  }

  const rosterSlot = rosterSlots[0]

  // verify player is on the practice squad
  if (
    rosterSlot.slot !== constants.slots.PS &&
    rosterSlot.slot !== constants.slots.PSD
  ) {
    throw new Error('player is not on a practice squad')
  }

  // verify poaching team has active roster space
  const pids = [pid]
  if (release.length) {
    release.map((pid) => pids.push(pid))
  }
  const player_rows = await db('player').whereIn('pid', pids)
  const poach_player_row = player_rows.find((p) => p.pid === pid)
  const league = await getLeague({ lid })
  const rosterRow = await getRoster({ tid })
  const roster = new Roster({ roster: rosterRow, league })
  const releasePlayers = []
  if (release.length) {
    for (const release_pid of release) {
      if (roster.has(release_pid)) {
        roster.removePlayer(release_pid)
        releasePlayers.push(release_pid)
      }
    }
  }
  const hasSlot = roster.hasOpenBenchSlot(poach_player_row.pos)
  if (!hasSlot) {
    throw new Error('poaching claim unsuccessful, no available roster space')
  }

  // verify team has enough cap if during the offseason
  const { value } = await getLastTransaction({
    pid,
    lid,
    tid: rosterSlot.tid
  })
  const playerPoachValue = value + 2
  if (
    !constants.season.isRegularSeason &&
    roster.availableCap - playerPoachValue < 0
  ) {
    throw new Error('not enough available cap')
  }

  // process release
  if (releasePlayers.length) {
    for (const release_pid of releasePlayers) {
      await processRelease({ release_pid, tid, lid, userid })
    }
  }

  // remove player from poached team rosters
  const poachedTeamRosters = await db('rosters')
    .where('week', '>=', constants.season.week)
    .where('tid', rosterSlot.tid)
    .where('year', constants.season.year)
  const poachedTeamRosterIds = poachedTeamRosters.map((r) => r.uid)
  await db('rosters_players')
    .whereIn('rid', poachedTeamRosterIds)
    .where('pid', pid)
    .del()

  const transaction = {
    userid,
    tid,
    lid,
    pid,
    type: constants.transactions.POACHED,
    value: playerPoachValue,
    week: constants.season.week,
    year: constants.season.year,
    timestamp: Math.round(Date.now() / 1000)
  }
  await db('transactions').insert(transaction)

  // add player to poaching team roster
  await db('rosters_players').insert({
    rid: rosterRow.uid,
    slot: constants.slots.BENCH,
    pid,
    pos: poach_player_row.pos,
    extensions: 0
  })

  // award conditional pick to poached team
  await createConditionalPick({
    tid: rosterSlot.tid,
    league
  })

  // send notification
  let message = `Poaching claim for ${poach_player_row.fname} ${poach_player_row.lname} (${poach_player_row.pos}) successfully processed.`
  if (release.length) {
    for (const release_pid of release) {
      if (roster.has(release_pid)) {
        const release_player_row = player_rows.find(
          (p) => p.pid === release_pid
        )
        message += ` ${release_player_row.fname} ${release_player_row.lname} (${release_player_row.pos}) has been released.`
      }
    }
  }

  await sendNotifications({
    league,
    notifyLeague: true,
    message
  })
}
