import db from '#db'
import { constants } from '#libs-shared'
import { is_main } from '#libs-server'

export default async function get_super_priority_status({
  pid,
  lid,
  release_tid = null
}) {
  // Calculate eligibility from authoritative source tables
  const eligibility = await calculate_super_priority_from_source({
    pid,
    lid,
    release_tid
  })

  if (!eligibility.eligible) {
    return eligibility
  }

  // Check super_priority table for cached/indexed data (for performance)
  const super_priority_record = await db('super_priority')
    .where({
      pid,
      lid,
      original_tid: eligibility.original_tid,
      poaching_tid: eligibility.poaching_tid
    })
    .where('eligible', 1)
    .where('claimed', 0)
    .first()

  // Check if there's a claimed record for this player/poach combination
  const claimed_record = await db('super_priority')
    .where({
      pid,
      lid,
      original_tid: eligibility.original_tid,
      poaching_tid: eligibility.poaching_tid
    })
    .where('claimed', 1)
    .first()

  if (claimed_record) {
    return {
      eligible: false,
      original_tid: eligibility.original_tid,
      reason: 'Super priority already claimed'
    }
  }

  return {
    ...eligibility,
    super_priority_uid: super_priority_record?.uid || null
  }
}

// Calculate super priority eligibility from authoritative source tables
async function calculate_super_priority_from_source({
  pid,
  lid,
  release_tid = null
}) {
  // Find the most recent transaction to determine if player is free agent or rostered
  const most_recent_transaction = await db('transactions')
    .where({ pid, lid })
    .orderBy('timestamp', 'desc')
    .limit(1)

  if (!most_recent_transaction.length) {
    return {
      eligible: false,
      original_tid: null,
      reason: 'Player was not poached'
    }
  }

  const is_free_agent =
    most_recent_transaction[0].type === constants.transactions.ROSTER_RELEASE

  let poached_transactions

  if (is_free_agent) {
    // For free agents: consider poaches that happened BEFORE the current release
    // Player was: original team → poached → released (free agent)
    const current_release = most_recent_transaction[0]

    // Find poaches that happened before this release
    let query = db('transactions')
      .where({ pid, lid, type: constants.transactions.POACHED })
      .where('timestamp', '<', current_release.timestamp)

    // Filter by release_tid if provided
    if (release_tid !== null) {
      query = query.where('tid', release_tid)
    }

    poached_transactions = await query.orderBy('timestamp', 'desc').limit(1)
  } else {
    // For rostered players: consider poaches that happened AFTER the most recent release
    // Player was: released → poached → still rostered
    const most_recent_release = await db('transactions')
      .where({ pid, lid, type: constants.transactions.ROSTER_RELEASE })
      .orderBy('timestamp', 'desc')
      .limit(1)

    if (most_recent_release.length) {
      // Find poaches after the most recent release
      let query = db('transactions')
        .where({ pid, lid, type: constants.transactions.POACHED })
        .where('timestamp', '>', most_recent_release[0].timestamp)

      // Filter by release_tid if provided
      if (release_tid !== null) {
        query = query.where('tid', release_tid)
      }

      poached_transactions = await query.orderBy('timestamp', 'desc').limit(1)
    } else {
      // No release found, consider all poaches
      let query = db('transactions').where({
        pid,
        lid,
        type: constants.transactions.POACHED
      })

      // Filter by release_tid if provided
      if (release_tid !== null) {
        query = query.where('tid', release_tid)
      }

      poached_transactions = await query.orderBy('timestamp', 'desc').limit(1)
    }
  }

  if (!poached_transactions.length) {
    return {
      eligible: false,
      original_tid: null,
      reason:
        release_tid !== null
          ? 'Player was not poached'
          : is_free_agent
            ? 'No valid poaches since most recent release'
            : 'No valid poaches after most recent release'
    }
  }

  const poach_transaction = poached_transactions[0]
  const poaching_tid = poach_transaction.tid
  const poach_timestamp = poach_transaction.timestamp

  // Find the original team by looking at transactions before the poach
  const pre_poach_transactions = await db('transactions')
    .where({ pid, lid })
    .where('timestamp', '<', poach_timestamp)
    .whereIn('type', [
      constants.transactions.PRACTICE_ADD,
      constants.transactions.DRAFT,
      constants.transactions.ROSTER_ADD,
      constants.transactions.ROSTER_DEACTIVATE,
      constants.transactions.POACHED
    ])
    .orderBy('timestamp', 'desc')
    .limit(1)

  if (!pre_poach_transactions.length) {
    return {
      eligible: false,
      original_tid: null,
      reason: 'Cannot determine original team'
    }
  }

  const original_tid = pre_poach_transactions[0].tid

  // Check if player was traded, signed as RFA, or extended by the poaching team
  const disqualifying_transactions = await db('transactions')
    .where({ pid, tid: poaching_tid, lid })
    .whereIn('type', [
      constants.transactions.TRADE,
      constants.transactions.RESTRICTED_FREE_AGENCY_TAG,
      constants.transactions.EXTENSION
    ])
    .where('timestamp', '>', poach_timestamp)
    .limit(1)

  if (disqualifying_transactions.length) {
    return {
      eligible: false,
      original_tid,
      reason: `Player was ${constants.transactionsDetail[disqualifying_transactions[0].type]?.toLowerCase() || 'disqualified'}`
    }
  }

  // Check if player has been rostered for 4+ weeks on poaching team
  const weeks_rostered = await db('rosters_players')
    .join('rosters', 'rosters_players.rid', 'rosters.uid')
    .where({
      'rosters_players.pid': pid,
      'rosters_players.tid': poaching_tid,
      'rosters_players.lid': lid
    })
    .where('rosters.year', constants.year)
    .where('rosters.week', '<=', constants.week) // Only count weeks up to current week
    .count('* as count')

  if (weeks_rostered[0].count >= 4) {
    return {
      eligible: false,
      original_tid,
      reason: 'Player rostered for 4+ weeks'
    }
  }

  // Check if player started 1+ games (was in a starting slot)
  const games_started = await db('rosters_players')
    .join('rosters', 'rosters_players.rid', 'rosters.uid')
    .where({
      'rosters_players.pid': pid,
      'rosters_players.tid': poaching_tid,
      'rosters_players.lid': lid
    })
    .where('rosters.year', constants.year)
    .whereIn('rosters_players.slot', constants.starterSlots)
    .count('* as count')

  if (games_started[0].count >= 1) {
    return {
      eligible: false,
      original_tid,
      reason: 'Player started in 1+ games'
    }
  }

  return {
    eligible: true,
    original_tid,
    poaching_tid,
    poach_date: new Date(poach_timestamp * 1000),
    poach_timestamp,
    weeks_since_poach: Math.floor(
      (Date.now() / 1000 - poach_timestamp) / (7 * 24 * 60 * 60)
    )
  }
}

const main = async () => {
  const pid = process.argv[2]
  const lid = process.argv[3] || 1

  if (!pid) {
    console.log('Usage: node get-super-priority-status.mjs <pid> [lid]')
    process.exit(1)
  }

  const status = await get_super_priority_status({ pid, lid })
  console.log(status)
  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}
