import debug from 'debug'

import db from '#db'
import { constants } from '#libs-shared'
import { is_main } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('reset-player-transition-tags')

const run = async () => {
  const lid = 1

  // Get all transition bids for the current year
  const transition_bids = await db('transition_bids')
    .where({
      year: constants.season.year,
      lid
    })
    .whereNull('cancelled')

  // Get all teams for the league for the current year
  const teams = await db('teams')
    .where({
      year: constants.season.year,
      lid
    })
    .orderBy('uid')

  log(`Found ${teams.length} teams in the league`)

  let total_updated = 0

  // Iterate through each team in the league
  for (const team of teams) {
    // Reset tags for this team's roster, excluding players with bids for the current year
    const query = db('rosters_players')
      .update({ tag: constants.tags.REGULAR })
      .where({
        tag: constants.tags.TRANSITION,
        week: 0,
        year: constants.season.year,
        tid: team.uid
      })

    const team_transition_bids = transition_bids.filter(
      (bid) => bid.tid === team.uid
    )
    const team_transition_pids = team_transition_bids.map((bid) => bid.pid)

    // Exclude players with bids for the current year
    if (team_transition_pids.length > 0) {
      query.whereNotIn('pid', team_transition_pids)
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
  debug.enable('reset-player-transition-tags')

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
