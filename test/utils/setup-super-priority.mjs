import db from '#db'
import {
  current_season,
  roster_slot_types,
  transaction_types,
  player_tag_types
} from '#constants'
import { epoch_to_timestamptz } from '#libs-shared'

export default async function setupSuperPriority({
  player,
  original_team_id,
  poaching_team_id,
  league_id = 1,
  original_user_id = 1,
  poaching_user_id = 2,
  weeks_ago = 1,
  player_status = 'free_agent', // 'free_agent' or 'rostered'
  add_previous_release = false // Set to true to add a release before poach (for rostered scenario)
}) {
  const currentTimestamp = Math.round(Date.now() / 1000)
  const poachTimestamp = currentTimestamp - weeks_ago * 7 * 24 * 60 * 60
  const originalAddTimestamp = poachTimestamp - 24 * 60 * 60 // 1 day before poach
  const previousReleaseTimestamp = originalAddTimestamp - 24 * 60 * 60 // 1 day before original add

  // Step 0: Optionally add previous release (for rostered scenario)
  if (add_previous_release) {
    await db('transactions').insert({
      user_id: original_user_id,
      tid: original_team_id,
      lid: league_id,
      pid: player.pid,
      type: transaction_types.ROSTER_RELEASE,
      player_salary: 0,
      week: current_season.week,
      season_year: current_season.year,
      occurred_at: epoch_to_timestamptz(previousReleaseTimestamp)
    })
  }

  // Step 1: Add player to original team's practice squad
  // First get the roster
  const originalRosters = await db('rosters')
    .where({
      week: current_season.week,
      season_year: current_season.year,
      tid: original_team_id
    })
    .limit(1)
  const originalRosterId = originalRosters[0].uid

  // Insert transaction with custom timestamp
  await db('transactions').insert({
    user_id: original_user_id,
    tid: original_team_id,
    lid: league_id,
    pid: player.pid,
    type: transaction_types.PRACTICE_ADD,
    player_salary: 0,
    week: current_season.week,
    season_year: current_season.year,
    occurred_at: epoch_to_timestamptz(originalAddTimestamp)
  })

  // Insert roster entry
  await db('rosters_players').insert({
    roster_id: originalRosterId,
    pid: player.pid,
    slot: roster_slot_types.PS,
    player_position: player.secondary_position,
    tag: player_tag_types.REGULAR,
    tid: original_team_id,
    lid: league_id,
    season_year: current_season.year,
    week: current_season.week
  })

  // Step 2: Create poach transaction
  await db('transactions').insert({
    user_id: poaching_user_id,
    tid: poaching_team_id,
    lid: league_id,
    pid: player.pid,
    type: transaction_types.POACHED,
    player_salary: 0,
    week: current_season.week,
    season_year: current_season.year,
    occurred_at: epoch_to_timestamptz(poachTimestamp)
  })

  // Step 3: Remove player from original team's roster (simulate poach effect)
  await db('rosters_players')
    .where({
      pid: player.pid,
      roster_id: originalRosterId
    })
    .del()

  // Step 4: Add player to poaching team's roster
  // Get poaching team roster
  const poachingRosters = await db('rosters')
    .where({
      week: current_season.week,
      season_year: current_season.year,
      tid: poaching_team_id
    })
    .limit(1)
  const poachingRosterId = poachingRosters[0].uid

  // Insert roster entry for poaching team
  await db('rosters_players').insert({
    roster_id: poachingRosterId,
    pid: player.pid,
    slot: roster_slot_types.PS,
    player_position: player.secondary_position,
    tag: player_tag_types.REGULAR,
    tid: poaching_team_id,
    lid: league_id,
    season_year: current_season.year,
    week: current_season.week
  })

  // Step 5: Conditionally release player or keep rostered
  let releaseTimestamp = null
  if (player_status === 'free_agent') {
    // Release player to make them a free agent
    releaseTimestamp = currentTimestamp

    await db('transactions').insert({
      user_id: poaching_user_id,
      tid: poaching_team_id,
      lid: league_id,
      pid: player.pid,
      type: transaction_types.ROSTER_RELEASE,
      player_salary: 0,
      week: current_season.week,
      season_year: current_season.year,
      occurred_at: epoch_to_timestamptz(releaseTimestamp)
    })

    // Remove from roster
    await db('rosters_players')
      .where({
        pid: player.pid,
        roster_id: poachingRosterId
      })
      .del()
  }
  // If player_status === 'rostered', player remains on poaching team

  return {
    poach_timestamp: poachTimestamp,
    original_timestamp: originalAddTimestamp,
    release_timestamp: releaseTimestamp,
    is_free_agent: player_status === 'free_agent'
  }
}
