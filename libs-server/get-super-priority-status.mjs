import db from '#db'
import {
  current_season,
  transaction_types,
  starting_lineup_slots,
  active_roster_slots,
  transaction_type_display_names
} from '#constants'
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
  // When release_tid is provided, look at transactions from that team specifically
  let most_recent_transaction_query = db('transactions').where({ pid, lid })

  if (release_tid !== null) {
    most_recent_transaction_query = most_recent_transaction_query.where(
      'tid',
      release_tid
    )
  }

  const most_recent_transaction = await most_recent_transaction_query
    .orderBy('timestamp', 'desc')
    .orderBy('uid', 'desc') // Secondary sort by uid for same-timestamp transactions
    .limit(1)

  if (!most_recent_transaction.length) {
    return {
      eligible: false,
      original_tid: null,
      reason: 'Player was not poached'
    }
  }

  const is_free_agent =
    most_recent_transaction[0].type === transaction_types.ROSTER_RELEASE

  let poached_transactions

  if (is_free_agent) {
    // For free agents: consider poaches that happened BEFORE or AT the current release
    // Player was: original team → poached → released (free agent)
    // Use <= to handle immediate release scenarios where poach and release happen at same timestamp
    const current_release = most_recent_transaction[0]

    // Find poaches that happened before or at this release
    let query = db('transactions')
      .where({ pid, lid, type: transaction_types.POACHED })
      .where('timestamp', '<=', current_release.timestamp)

    // Filter by release_tid if provided
    if (release_tid !== null) {
      query = query.where('tid', release_tid)
    }

    poached_transactions = await query.orderBy('timestamp', 'desc').limit(1)
  } else {
    // For rostered players: consider poaches that happened AFTER the most recent release
    // Player was: released → poached → still rostered
    const most_recent_release = await db('transactions')
      .where({ pid, lid, type: transaction_types.ROSTER_RELEASE })
      .orderBy('timestamp', 'desc')
      .limit(1)

    if (most_recent_release.length) {
      // Find poaches after the most recent release
      let query = db('transactions')
        .where({ pid, lid, type: transaction_types.POACHED })
        .where('timestamp', '>=', most_recent_release[0].timestamp)

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
        type: transaction_types.POACHED
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

  // Find the original team by looking at transactions before or at the poach time
  // Use <= to handle immediate release scenarios where all transactions have same timestamp
  // Exclude the poach transaction itself by filtering out transactions from the poaching team
  const pre_poach_transactions = await db('transactions')
    .where({ pid, lid })
    .where('timestamp', '<=', poach_timestamp)
    .whereNot('tid', poaching_tid) // Exclude poaching team's transactions
    .whereIn('type', [
      transaction_types.PRACTICE_ADD,
      transaction_types.DRAFT,
      transaction_types.ROSTER_ADD,
      transaction_types.ROSTER_DEACTIVATE,
      transaction_types.POACHED
    ])
    .orderBy('timestamp', 'desc')
    .orderBy('uid', 'desc')
    .limit(1)

  if (!pre_poach_transactions.length) {
    return {
      eligible: false,
      original_tid: null,
      reason: 'Cannot determine original team'
    }
  }

  const original_tid = pre_poach_transactions[0].tid

  // Check if player was traded or signed as RFA by the poaching team.
  // Per Amendment XXXIV §4, EXTENSION is handled separately because it only
  // disqualifies when the player remained on the Active roster at the start
  // of the Regular Season.
  const disqualifying_transactions = await db('transactions')
    .where({ pid, tid: poaching_tid, lid })
    .whereIn('type', [
      transaction_types.TRADE,
      transaction_types.RESTRICTED_FREE_AGENCY_TAG
    ])
    .where('timestamp', '>', poach_timestamp)
    .limit(1)

  if (disqualifying_transactions.length) {
    return {
      eligible: false,
      original_tid,
      reason: `Player was ${transaction_type_display_names[disqualifying_transactions[0].type]?.toLowerCase() || 'disqualified'}`
    }
  }

  // Extension trigger (Amendment XXXIV §4): joint condition. Disqualify only
  // when (a) an extension exists after the poach, (b) the Regular Season has
  // started, and (c) the player was on the Active roster at the start of the
  // Regular Season. Pre-Regular-Season releases preserve eligibility.
  const extension_transactions = await db('transactions')
    .where({ pid, tid: poaching_tid, lid })
    .where('type', transaction_types.EXTENSION)
    .where('timestamp', '>', poach_timestamp)
    .limit(1)

  // Roster snapshots are scoped to the poach year — for prior-season poaches
  // evaluated in a later season, the relevant context is the season the
  // poach occurred in, not current_season.
  const poach_year = poach_transaction.year
  if (poach_year == null) {
    return {
      eligible: false,
      original_tid,
      reason: 'Cannot determine poach year'
    }
  }

  if (extension_transactions.length) {
    // Joint-condition gate: the Regular Season must have started for the
    // poach year. For prior-season poaches this is trivially true.
    let regular_season_started
    if (poach_year < current_season.year) {
      regular_season_started = true
    } else {
      const regular_season_first_day = current_season.regular_season_start.add(
        1,
        'week'
      )
      regular_season_started = !current_season.now.isBefore(
        regular_season_first_day
      )
    }

    if (regular_season_started) {
      const active_at_regular_season_start = await db('rosters_players')
        .join('rosters', 'rosters_players.rid', 'rosters.uid')
        .where({
          'rosters_players.pid': pid,
          'rosters_players.tid': poaching_tid,
          'rosters_players.lid': lid
        })
        .where('rosters.year', poach_year)
        .where('rosters.week', 1)
        .whereIn('rosters_players.slot', active_roster_slots)
        .first()

      if (active_at_regular_season_start) {
        return {
          eligible: false,
          original_tid,
          reason: `Player was ${transaction_type_display_names[transaction_types.EXTENSION]?.toLowerCase() || 'extended'}`
        }
      }
    }
  }

  // Check if player has been rostered for 4+ weeks on poaching team
  // (counted within the poach year)
  const weeks_rostered_query = db('rosters_players')
    .join('rosters', 'rosters_players.rid', 'rosters.uid')
    .where({
      'rosters_players.pid': pid,
      'rosters_players.tid': poaching_tid,
      'rosters_players.lid': lid
    })
    .where('rosters.year', poach_year)
    .where('rosters.week', '>=', 1)

  if (poach_year === current_season.year) {
    weeks_rostered_query.where('rosters.week', '<=', current_season.week)
  }

  const weeks_rostered = await weeks_rostered_query.count('* as count')

  if (weeks_rostered[0].count >= 4) {
    return {
      eligible: false,
      original_tid,
      reason: 'Player rostered for 4+ weeks'
    }
  }

  // Check if player started 1+ games (was in a starting slot) in the poach year
  const games_started_query = db('rosters_players')
    .join('rosters', 'rosters_players.rid', 'rosters.uid')
    .where({
      'rosters_players.pid': pid,
      'rosters_players.tid': poaching_tid,
      'rosters_players.lid': lid
    })
    .where('rosters.year', poach_year)
    .where('rosters.week', '>=', 1)
    .whereIn('rosters_players.slot', starting_lineup_slots)

  if (poach_year === current_season.year) {
    games_started_query.where('rosters.week', '<=', current_season.week)
  }

  const games_started = await games_started_query.count('* as count')

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
