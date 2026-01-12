import { arrayToSentence, Roster } from '#libs-shared'
import {
  current_season,
  roster_slot_types,
  player_tag_types,
  transaction_types
} from '#constants'
import db from '#db'
import getRoster from './get-roster.mjs'
import getLeague from './get-league.mjs'
import processRelease from './process-release.mjs'
import sendNotifications from './send-notifications.mjs'
import create_conditional_pick from './create-conditional-pick.mjs'
import getTeam from './get-team.mjs'
import debug from 'debug'

const log = debug('process-restricted-free-agency-bids')

export default async function ({
  pid,
  bid,
  tid,
  lid,
  userid,
  player_tid,
  uid
}) {
  // check player is on original team roster
  const isOriginalTeam = player_tid === tid
  const originalTeamRoster = await getRoster({ tid: player_tid })
  const playerRosterRow = originalTeamRoster.players.find((p) => p.pid === pid)
  if (!playerRosterRow) {
    throw new Error('player no longer on original team roster')
  }

  if (playerRosterRow.tag !== player_tag_types.RESTRICTED_FREE_AGENCY) {
    throw new Error('player no longer a restricted free agent')
  }

  const pos = playerRosterRow.pos
  const slot = roster_slot_types.BENCH
  const league = await getLeague({ lid })
  const rosterRow = await getRoster({ tid })
  const roster = new Roster({ roster: rosterRow, league })

  const releases = await db('restricted_free_agency_releases').where(
    'restricted_free_agency_bid_id',
    uid
  )
  const cutlist_rows = await db('league_cutlist')
    .where('tid', tid)
    .orderBy('order', 'asc')
  const release_pids = []

  const isValid = () =>
    roster.availableSpace >= 1 &&
    roster.availableCap >= bid &&
    roster.isEligibleForSlot({ slot, pos })

  if (isOriginalTeam) {
    roster.removePlayer(pid)
  }

  // remove conditional releases
  if (releases.length) {
    for (const release of releases) {
      if (!roster.has(release.pid)) {
        continue
      }
      roster.removePlayer(release.pid)
      release_pids.push(release.pid)
    }
  }

  while (!isValid() && cutlist_rows.length) {
    const cutlist_row = cutlist_rows.shift()
    if (!roster.has(cutlist_row.pid)) {
      continue
    }

    roster.removePlayer(cutlist_row.pid)
    release_pids.push(cutlist_row.pid)
  }

  if (!isValid()) {
    throw new Error('exceeds roster limits')
  }

  if (!isOriginalTeam) {
    // remove player from original team roster
    await db('rosters_players')
      .del()
      .where({ rid: originalTeamRoster.uid, pid })

    // add player to competing team roster
    await db('rosters_players').insert({
      rid: roster.uid,
      pid,
      pos,
      slot: roster_slot_types.BENCH,
      tag: player_tag_types.RESTRICTED_FREE_AGENCY,
      extensions: 0,
      tid,
      lid,
      year: current_season.year,
      week: current_season.week
    })

    // add conditional pick to original team
    await create_conditional_pick({
      tid: player_tid,
      league
    })
  }

  // release conditional & cutlist players
  for (const release_pid of release_pids) {
    await processRelease({ lid, tid, release_pid, userid })
  }

  // create transaction
  const addTransaction = {
    userid,
    tid,
    lid,
    pid,
    type: transaction_types.RESTRICTED_FREE_AGENCY_TAG,
    value: bid,
    week: current_season.week,
    year: current_season.year,
    timestamp: Math.round(Date.now() / 1000)
  }
  await db('transactions').insert(addTransaction)

  const pids = [pid]
  release_pids.forEach((release_pid) => pids.push(release_pid))
  const player_rows = await db('player').whereIn('pid', pids)
  const player_row = player_rows.find((p) => p.pid === pid)
  const team = await getTeam(tid)

  // send notification
  let message = `${team.name} (${team.abbrv}) has signed restricted free agent ${player_row.fname} ${player_row.lname} (${player_row.pos}) for $${bid}. `
  if (release_pids.length) {
    const releaseMessages = []
    for (const release_pid of release_pids) {
      const release_player_row = player_rows.find((p) => p.pid === release_pid)
      releaseMessages.push(
        `${release_player_row.fname} ${release_player_row.lname} (${release_player_row.pos})`
      )
    }

    message += `${arrayToSentence(releaseMessages)} has been released.`
  }

  log(message)

  await sendNotifications({
    league,
    notifyLeague: true,
    message
  })
}
