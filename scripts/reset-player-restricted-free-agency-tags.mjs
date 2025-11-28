import debug from 'debug'

import db from '#db'
import { current_season, player_tag_types } from '#constants'
import { is_main } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('reset-player-restricted-free-agency-tags')

const run = async () => {
  const lid = 1

  // Get all restricted free agency bids for the current year
  const restricted_free_agency_bids = await db('restricted_free_agency_bids')
    .where({
      year: current_season.year,
      lid
    })
    .whereNull('cancelled')

  // Get all teams for the league for the current year
  const teams = await db('teams')
    .where({
      year: current_season.year,
      lid
    })
    .orderBy('uid')

  log(`Found ${teams.length} teams in the league`)

  let total_updated = 0

  // Iterate through each team in the league
  for (const team of teams) {
    // Reset tags for this team's roster, excluding players with bids for the current year
    const query = db('rosters_players')
      .update({ tag: player_tag_types.REGULAR })
      .where({
        tag: player_tag_types.RESTRICTED_FREE_AGENCY,
        week: 0,
        year: current_season.year,
        tid: team.uid
      })

    const team_restricted_free_agency_bids = restricted_free_agency_bids.filter(
      (bid) => bid.tid === team.uid
    )
    const team_restricted_free_agency_pids =
      team_restricted_free_agency_bids.map((bid) => bid.pid)

    // Exclude players with bids for the current year
    if (team_restricted_free_agency_pids.length > 0) {
      query.whereNotIn('pid', team_restricted_free_agency_pids)
    }

    const updated_count = await query
    total_updated += updated_count

    if (updated_count > 0) {
      log(
        `Updated ${updated_count} roster slots for team ${team.name} (ID: ${team.uid})`
      )
    }
  }

  log(
    `Total updated: ${total_updated} roster slots across ${teams.length} teams`
  )
}

const main = async () => {
  debug.enable('reset-player-restricted-free-agency-tags')

  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
