import debug from 'debug'

import db from '#db'
import { current_season, player_tag_types } from '#constants'
import { is_main, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

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

  const protected_pids_by_tid = {}
  for (const bid of restricted_free_agency_bids) {
    if (!protected_pids_by_tid[bid.tid]) protected_pids_by_tid[bid.tid] = []
    protected_pids_by_tid[bid.tid].push(bid.pid)
  }

  // Get all teams for the league for the current year
  const teams = await db('teams')
    .where({
      year: current_season.year,
      lid
    })
    .orderBy('uid')

  log(`Found ${teams.length} teams in the league`)

  // Pre-flight: count eligible-to-reset rows (tag=RFA, no active bid protecting them)
  // so the post-run oracle can confirm they were actually cleared.
  let eligible_before = 0
  for (const team of teams) {
    const protected_pids = protected_pids_by_tid[team.uid] || []
    const count_query = db('rosters_players').count({ n: '*' }).where({
      tag: player_tag_types.RESTRICTED_FREE_AGENCY,
      week: 0,
      year: current_season.year,
      tid: team.uid
    })
    if (protected_pids.length > 0) {
      count_query.whereNotIn('pid', protected_pids)
    }
    const [{ n }] = await count_query
    eligible_before += Number(n)
  }
  log(`Eligible-to-reset RFA tag rows before run: ${eligible_before}`)

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

    const team_restricted_free_agency_pids =
      protected_pids_by_tid[team.uid] || []

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

  // Oracle: if there were no eligible rows to reset this is a legitimate no-op.
  if (eligible_before === 0) {
    log('No eligible RFA tags to reset — no-op run, oracle satisfied')
    return { shortfall: null }
  }

  // Post-run: recount eligible rows. Any survivors are uncleared tags — a bug.
  let remaining = 0
  for (const team of teams) {
    const protected_pids = protected_pids_by_tid[team.uid] || []
    const count_query = db('rosters_players').count({ n: '*' }).where({
      tag: player_tag_types.RESTRICTED_FREE_AGENCY,
      week: 0,
      year: current_season.year,
      tid: team.uid
    })
    if (protected_pids.length > 0) {
      count_query.whereNotIn('pid', protected_pids)
    }
    const [{ n }] = await count_query
    remaining += Number(n)
  }

  if (remaining > 0) {
    return {
      shortfall: `${remaining} unprotected RFA tag(s) still set after reset (eligible_before=${eligible_before}, year=${current_season.year}, lid=${lid})`
    }
  }

  log(
    `Oracle satisfied: all ${eligible_before} eligible RFA tag(s) cleared (total_updated=${total_updated})`
  )
  return { shortfall: null }
}

const main = async () => {
  debug.enable('reset-player-restricted-free-agency-tags')

  let error
  try {
    const result = await run()
    if (result?.shortfall) {
      const err = new Error(result.shortfall)
      err.row_count_shortfall = true
      throw err
    }
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.RESET_PLAYER_TAGS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
