import db from '#db'
import { Roster } from '#libs-shared'
import {
  current_season,
  roster_slot_types,
  player_tag_types,
  transaction_types
} from '#constants'
import getRoster from './get-roster.mjs'
import getLeague from './get-league.mjs'
import sendNotifications from './send-notifications.mjs'
import processRelease from './process-release.mjs'
import get_original_practice_squad_designation from './get-original-practice-squad-designation.mjs'
import { is_main } from '#libs-server'

export default async function process_super_priority({
  pid,
  original_tid,
  lid,
  super_priority_id,
  user_id = null,
  release = []
}) {
  // Both consumers below -- transactions.occurred_at and
  // super_priority.claimed_at -- are timestamptz, so this stays a Date rather
  // than an epoch that converts twice.
  const occurred_at = new Date()

  // Get league info
  const league = await getLeague({ lid })
  if (!league) {
    throw new Error('Invalid league ID')
  }

  // Get original team roster for the week every write below targets.
  // getRoster defaults to `fantasy_season_week`, which is 0 outside the regular
  // season, so the space and protected-player checks would otherwise run
  // against a different week's roster than the one being mutated.
  const rosterRow = await getRoster({
    tid: original_tid,
    week: current_season.week
  })
  const roster = new Roster({ roster: rosterRow, league })

  // Get player info
  const player_rows = await db('player').where({ pid }).limit(1)
  if (!player_rows.length) {
    throw new Error('Invalid player ID')
  }
  const player_row = player_rows[0]

  // knex throws a bare `Undefined binding(s) detected` on an undefined value in
  // an object-form where, so this is checked before the query rather than
  // surfacing as an error that never names this function.
  if (super_priority_id === undefined) {
    throw new Error('super_priority_id is required')
  }

  const super_priority_record = await db('super_priority')
    .where({ super_priority_id })
    .first()

  // The waiver caller checks eligibility through get_super_priority_status
  // before dispatching here, but the exported function and the CLI below are
  // both entry points in their own right: without these the record's state is
  // never read, and a stale or already-claimed id would add a second roster row
  // and a second SUPER_PRIORITY transaction.
  if (!super_priority_record) {
    throw new Error(`Invalid super priority ID: ${super_priority_id}`)
  }

  if (!super_priority_record.eligible) {
    throw new Error('Super priority claim is not eligible')
  }

  if (super_priority_record.claimed) {
    throw new Error('Super priority claim has already been processed')
  }

  // Amendment XXXIV section 16: the player is "placed back on the Practice
  // Squad (drafted or signed)" -- the designation they held before the poach.
  // It is NOT a function of whether the claim needed a waiver, which is how
  // this read before: an originally-signed player whose team happened to have
  // an open slot at release time took the requires_waiver=0 branch and returned
  // as PSD, converting them to drafted and landing them in the uncapped bucket.
  // That was the only path by which this flow could overfill a practice squad.
  //
  // A player with no practice squad history on the original team returns as
  // drafted, which is both the prior behaviour and the safe reading -- PSD
  // carries no salary-cap or position-limit claim on the roster.
  const original_designation = await get_original_practice_squad_designation({
    pid,
    tid: original_tid,
    lid
  })
  const target_slot = original_designation || roster_slot_types.PSD

  // Handle waiver releases - validate and simulate before checking space
  if (release.length) {
    for (const release_pid of release) {
      const releasePlayer = roster.get(release_pid)
      if (!releasePlayer) {
        throw new Error(`Release player ${release_pid} not found on roster`)
      }

      // Validate release isn't a protected player
      if (
        releasePlayer.slot === roster_slot_types.PSP ||
        releasePlayer.slot === roster_slot_types.PSDP
      ) {
        throw new Error('Cannot release protected practice squad players')
      }

      // Simulate removal to check if space will be available
      roster.removePlayer(release_pid)
    }
  }

  // Check practice squad space and position limits after simulated releases.
  // Gated on the TARGET SLOT rather than on requires_waiver: the cap and the
  // position limits apply to signed slots (PS/PSP) and exclude PSD/PSDP, so
  // this is the condition that decides whether there is anything to check.
  // Applying it to a drafted return would refuse a claim against a limit that
  // slot does not participate in.
  if (
    target_slot === roster_slot_types.PS &&
    !roster.has_practice_squad_space_for_position(player_row.primary_position)
  ) {
    throw new Error(
      'No practice squad space available or position limit exceeded'
    )
  }

  // Process releases now that we've validated space will be available
  if (release.length) {
    for (const release_pid of release) {
      await processRelease({
        release_pid,
        tid: original_tid,
        lid,
        user_id: user_id || 0
      })
    }
  }

  // Add player to the original team's roster for the current week only. Later
  // weeks are not written here: generate-rosters.mjs builds each next week from
  // the preceding one, so the player carries forward. This matches every other
  // add path -- submit-acquisition, process-poach,
  // process-restricted-free-agency-bid -- while only REMOVALS fan out over
  // `week >= current_season.week`.
  await db('rosters_players').insert({
    roster_id: rosterRow.roster_id,
    slot: target_slot,
    pid,
    player_position: player_row.primary_position,
    tag: player_tag_types.REGULAR,
    extensions: 0,
    tid: original_tid,
    lid,
    week: current_season.week,
    season_year: current_season.year
  })

  // Create transaction
  const transaction_type = transaction_types.SUPER_PRIORITY

  // Get original practice squad salary for the player
  const last_transaction = await db('transactions')
    .where({ pid, tid: original_tid, lid })
    .whereIn('type', [
      transaction_types.PRACTICE_ADD,
      transaction_types.DRAFT,
      transaction_types.ROSTER_DEACTIVATE
    ])
    .orderBy('occurred_at', 'desc')
    .limit(1)

  if (!last_transaction.length) {
    throw new Error('No last transaction found')
  }

  const player_salary = last_transaction[0].player_salary

  const transaction = {
    user_id: user_id || 0, // use provided user_id or default to system user
    tid: original_tid,
    lid,
    pid,
    type: transaction_type,
    player_salary,
    week: current_season.week,
    season_year: current_season.year,
    occurred_at
  }

  await db('transactions').insert(transaction)

  // Mark super priority as claimed
  await db('super_priority').where({ super_priority_id }).update({
    claimed: 1,
    claimed_at: occurred_at
  })

  // Get team info for notifications
  const team_rows = await db('teams')
    .where({ team_id: original_tid, lid, season_year: current_season.year })
    .limit(1)

  if (team_rows.length) {
    const team = team_rows[0]

    let message = `${player_row.first_name} ${player_row.last_name} (${player_row.primary_position}) has been claimed via Super Priority by ${team.name} (${team.abbreviation}).`

    // Add release information if players were released
    if (release.length) {
      const released_player_rows = await db('player').whereIn('pid', release)

      const released_names = released_player_rows
        .map((p) => `${p.first_name} ${p.last_name} (${p.primary_position})`)
        .join(', ')

      const verb = release.length === 1 ? 'has' : 'have'
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
    requires_waiver: Boolean(super_priority_record.requires_waiver)
  }
}

const main = async () => {
  const pid = process.argv[2]
  const original_tid = Number(process.argv[3])
  const lid = Number(process.argv[4])
  const super_priority_id = Number(process.argv[5])

  // All four are positional and required. `lid` cannot be made optional here
  // the way it is in the trailing-argument scripts: omitting it would shift the
  // super priority id into `lid` and leave `super_priority_id` as NaN.
  if (!pid || !original_tid || !lid || !super_priority_id) {
    console.log(
      'Usage: node process-super-priority.mjs <pid> <original_tid> <lid> <super_priority_id>'
    )
    process.exit(1)
  }

  try {
    const result = await process_super_priority({
      pid,
      original_tid,
      lid,
      super_priority_id
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
