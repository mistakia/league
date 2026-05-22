import debug from 'debug'

import db from '#db'
import { current_season, player_tag_types } from '#constants'
import { is_main, report_job, throw_if_shortfall } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('reset-player-restricted-free-agency-tags')

const apply_eligibility_filters = ({ query, team_uids, lid }) => {
  query
    .where({
      tag: player_tag_types.RESTRICTED_FREE_AGENCY,
      week: 0,
      year: current_season.year
    })
    .whereIn('tid', team_uids)
    .whereNotExists(function () {
      this.select('*')
        .from('restricted_free_agency_bids')
        .where('restricted_free_agency_bids.year', current_season.year)
        .where('restricted_free_agency_bids.lid', lid)
        .whereNull('restricted_free_agency_bids.cancelled')
        .whereRaw('restricted_free_agency_bids.tid = rosters_players.tid')
        .whereRaw('restricted_free_agency_bids.pid = rosters_players.pid')
    })
}

const count_eligible_rfa_rows = async ({ team_uids, lid }) => {
  const query = db('rosters_players')
  apply_eligibility_filters({ query, team_uids, lid })
  const [{ n }] = await query.count({ n: '*' })
  return Number(n)
}

const run = async () => {
  const lid = 1

  const teams = await db('teams')
    .where({
      year: current_season.year,
      lid
    })
    .orderBy('uid')

  const team_uids = teams.map((t) => t.uid)
  log(`Found ${teams.length} teams in the league`)

  // Pre-flight: count eligible-to-reset rows (tag=RFA, no active bid
  // protecting them) so the post-run oracle can confirm they were cleared.
  const eligible_before = await count_eligible_rfa_rows({ team_uids, lid })
  log(`Eligible-to-reset RFA tag rows before run: ${eligible_before}`)

  const update_query = db('rosters_players').update({
    tag: player_tag_types.REGULAR
  })
  apply_eligibility_filters({ query: update_query, team_uids, lid })

  const total_updated = await update_query
  log(
    `Total updated: ${total_updated} roster slots across ${teams.length} teams`
  )

  if (eligible_before === 0) {
    log('No eligible RFA tags to reset — no-op run, oracle satisfied')
    return { shortfall: null }
  }

  const remaining = await count_eligible_rfa_rows({ team_uids, lid })

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
    throw_if_shortfall(result?.shortfall)
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
