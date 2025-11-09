import db from '#db'
import { constants, Roster } from '#libs-shared'
import getRoster from './get-roster.mjs'
import getLeague from './get-league.mjs'
import sendNotifications from './send-notifications.mjs'
import processRelease from './process-release.mjs'
import { is_main } from '#libs-server'

export default async function process_super_priority({
  pid,
  original_tid,
  lid,
  super_priority_uid,
  userid = null,
  release = []
}) {
  const timestamp = Math.floor(Date.now() / 1000)

  // Get league info
  const league = await getLeague({ lid })
  if (!league) {
    throw new Error('Invalid league ID')
  }

  // Get original team roster
  const rosterRow = await getRoster({ tid: original_tid })
  const roster = new Roster({ roster: rosterRow, league })

  // Get player info
  const player_rows = await db('player').where({ pid }).limit(1)
  if (!player_rows.length) {
    throw new Error('Invalid player ID')
  }
  const player_row = player_rows[0]

  // Determine target slot based on super_priority record requirements
  const super_priority_record = await db('super_priority')
    .where({ uid: super_priority_uid })
    .first()

  let target_slot
  if (super_priority_record && super_priority_record.requires_waiver) {
    target_slot = constants.slots.PS
  } else {
    // Player can automatically return (was PSD or PS with open slot)
    target_slot = constants.slots.PSD
  }

  // Handle waiver releases - validate and simulate before checking space
  const releasePlayers = []
  if (release.length) {
    for (const release_pid of release) {
      const releasePlayer = roster.get(release_pid)
      if (!releasePlayer) {
        throw new Error(`Release player ${release_pid} not found on roster`)
      }

      // Validate release isn't a protected player
      if (
        releasePlayer.slot === constants.slots.PSP ||
        releasePlayer.slot === constants.slots.PSDP
      ) {
        throw new Error('Cannot release protected practice squad players')
      }

      releasePlayers.push(release_pid)
      // Simulate removal to check if space will be available
      roster.removePlayer(release_pid)
    }
  }

  // Check practice squad space after simulated releases
  if (
    super_priority_record &&
    super_priority_record.requires_waiver &&
    roster.practice_signed.length >= league.ps
  ) {
    throw new Error('No practice squad space available')
  }

  // Process releases now that we've validated space will be available
  if (releasePlayers.length) {
    for (const release_pid of releasePlayers) {
      await processRelease({
        release_pid,
        tid: original_tid,
        lid,
        userid: userid || 0
      })
    }
  }

  // Add player to original team roster for current and future weeks
  const current_week_roster = await db('rosters')
    .where('week', '>=', constants.week)
    .where('year', constants.year)
    .where('tid', original_tid)
    .first()

  if (!current_week_roster) {
    throw new Error('No current week roster found')
  }

  await db('rosters_players').insert({
    rid: current_week_roster.uid,
    slot: target_slot,
    pid,
    pos: player_row.pos,
    tag: constants.tags.REGULAR,
    extensions: 0,
    tid: original_tid,
    lid,
    week: current_week_roster.week,
    year: current_week_roster.year
  })

  // Create transaction
  const transaction_type = constants.transactions.SUPER_PRIORITY

  // Get original practice squad salary for the player
  const last_transaction = await db('transactions')
    .where({ pid, tid: original_tid, lid })
    .whereIn('type', [
      constants.transactions.PRACTICE_ADD,
      constants.transactions.DRAFT,
      constants.transactions.ROSTER_DEACTIVATE
    ])
    .orderBy('timestamp', 'desc')
    .limit(1)

  if (!last_transaction.length) {
    throw new Error('No last transaction found')
  }

  const value = last_transaction[0].value

  const transaction = {
    userid: userid || 0, // use provided userid or default to system user
    tid: original_tid,
    lid,
    pid,
    type: transaction_type,
    value,
    week: constants.week,
    year: constants.year,
    timestamp
  }

  await db('transactions').insert(transaction)

  // Mark super priority as claimed
  if (super_priority_uid === undefined) {
    throw new Error('super_priority_uid is undefined')
  }

  await db('super_priority').where({ uid: super_priority_uid }).update({
    claimed: 1,
    claimed_at: timestamp
  })

  // Get team info for notifications
  const team_rows = await db('teams')
    .where({ uid: original_tid, lid, year: constants.year })
    .limit(1)

  if (team_rows.length) {
    const team = team_rows[0]

    let message = `${player_row.fname} ${player_row.lname} (${player_row.pos}) has been claimed via Super Priority by ${team.name} (${team.abbrv}).`

    // Add release information if players were released
    if (releasePlayers.length) {
      const released_player_rows = await db('player').whereIn(
        'pid',
        releasePlayers
      )

      const released_names = released_player_rows
        .map((p) => `${p.fname} ${p.lname} (${p.pos})`)
        .join(', ')

      const verb = releasePlayers.length === 1 ? 'has' : 'have'
      message += ` ${released_names} ${verb} been released.`
    }

    await sendNotifications({
      league,
      notifyLeague: true,
      message
    })
  }

  return {
    pid,
    tid: original_tid,
    slot: target_slot,
    transaction,
    requires_waiver: super_priority_record?.requires_waiver || false
  }
}

const main = async () => {
  const pid = process.argv[2]
  const original_tid = Number(process.argv[3])
  const lid = Number(process.argv[4]) || 1
  const super_priority_uid = Number(process.argv[5])

  if (!pid || !original_tid || !super_priority_uid) {
    console.log(
      'Usage: node process-super-priority.mjs <pid> <original_tid> [lid] <super_priority_uid>'
    )
    process.exit(1)
  }

  try {
    const result = await process_super_priority({
      pid,
      original_tid,
      lid,
      super_priority_uid
    })
    console.log('Super priority processed:', result)
  } catch (error) {
    console.error('Error processing super priority:', error.message)
    process.exit(1)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}
