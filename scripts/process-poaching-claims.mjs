import dayjs from 'dayjs'
import debug from 'debug'

import db from '#db'
import {
  Errors,
  should_block_poach_processing,
  get_free_agent_period
} from '#libs-shared'
import { current_season } from '#constants'
import {
  processPoach,
  report_job,
  is_main,
  throw_if_shortfall,
  getLeague
} from '#libs-server'
import { is_auction_complete } from '#libs-server/auction-completion.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

// This script has no per-league loop -- it iterates claims directly across
// every league -- so the pause cannot be applied as a `continue`. It is a
// league-dimension FILTER on both the work query and the oracle instead, and
// the two must stay identical: a claim excluded from the work but counted by
// the oracle is a false shortfall on every paused run.
const exclude_paused_leagues = (query) =>
  query.whereNotExists(function () {
    this.select('*')
      .from('league_pauses')
      .whereRaw('league_pauses.league_id = poaches.lid')
      .whereNull('league_pauses.resumed_at')
  })

/**
 * Leagues whose free agency auction is still running.
 *
 * A POACH FILLS AN ACTIVE ROSTER SPOT, so awarding one mid-auction moves a team
 * out of an eligible set without passing through settlement -- and eligibility
 * monotonicity is the assumption second-price settlement rests on. The poaching
 * WAIVER runner already holds for this reason; the claims runner did not, and it
 * is the one with no per-league loop.
 *
 * Submission is refused for the whole period by sanctuary period 3, so what this
 * holds is a claim submitted in the 48 hours BEFORE the period opened and coming
 * due inside it.
 *
 * Held, not failed: the oracle below applies the same filter, because a claim
 * excluded from the work but counted by the oracle is a false shortfall on every
 * run of an auction week.
 */
const get_auction_held_league_ids = async (league_ids) => {
  const held = []
  for (const lid of league_ids) {
    const league = await getLeague({ lid })
    if (!league.free_agency_period_start) continue

    const period = get_free_agent_period(league)
    const is_within_period =
      !current_season.is_regular_season &&
      current_season.now.isBetween(period.start, period.end)
    if (!is_within_period) continue

    if (await is_auction_complete({ lid })) continue
    held.push(lid)
  }
  return held
}

const log = debug('process:claims')
if (process.env.NODE_ENV !== 'test') {
  enable_debug_namespaces('process:claims')
}

const run = async () => {
  const timestamp = new Date()

  const { now } = current_season
  // `poaches.submitted` is timestamptz, so this bound is an instant rather than
  // epoch seconds. Binding `.unix()` here is rejected by Postgres outright --
  // and this script is the whole poach-processing path, so a rejected bind is a
  // stopped pipeline rather than a wrong answer.
  const cutoff = dayjs().subtract('48', 'hours').toDate()
  const claims = await exclude_paused_leagues(
    db('poaches').where('submitted', '<', cutoff).whereNull('processed')
  )

  if (!claims.length) {
    throw new Errors.EmptyPoachingClaims()
  }

  const auction_held_league_ids = await get_auction_held_league_ids([
    ...new Set(claims.map((claim) => claim.lid))
  ])
  for (const lid of auction_held_league_ids) {
    log(`auction still running, holding poaching claims for league ${lid}`)
  }
  const eligible_claims = claims.filter(
    (claim) => !auction_held_league_ids.includes(claim.lid)
  )

  if (current_season.is_regular_season) {
    // check if currently between Saturday 6pm and Tuesday 3pm (EST)
    if (should_block_poach_processing(now)) {
      // do not process any claims during this window
      return { shortfall: null }
    }
  }

  for (const claim of eligible_claims) {
    let error
    try {
      const release = await db('poach_releases')
        .select('pid')
        .where('poach_id', claim.poach_id)

      await processPoach({
        release: release.map((r) => r.pid),
        ...claim
      })
      log(`poaching claim awarded to teamId: (${claim.tid}) for ${claim.pid}`)
    } catch (err) {
      error = err
      log(
        `poaching claim unsuccessful by teamId: (${claim.tid}) because ${error.message}`
      )
    }

    await db('poaches')
      .update('processed', timestamp)
      .update('reason', error ? error.message : null) // TODO - add error codes
      .update('is_successful', error ? 0 : 1)
      .where({
        pid: claim.pid,
        tid: claim.tid,
        lid: claim.lid
      })
  }

  // Oracle: verify no eligible-to-process claim remains pending after the run.
  // A paused league's claims, and a league whose auction is still running, are
  // held ON PURPOSE, so the same two filters the work query uses are applied
  // here -- otherwise the hold trips the very detector that exists to catch
  // claims being silently skipped.
  const remaining = await exclude_paused_leagues(
    db('poaches')
      .where('submitted', '<', cutoff)
      .whereNull('processed')
      .whereNotIn(
        'lid',
        auction_held_league_ids.length ? auction_held_league_ids : [0]
      )
      .count('* as count')
  ).first()
  const remaining_count = Number(remaining.count)
  if (remaining_count > 0) {
    return {
      shortfall: `${remaining_count} eligible poaching claim(s) still pending after run`
    }
  }

  return { shortfall: null }
}

export default run

const main = async () => {
  let error
  try {
    const result = await run()
    throw_if_shortfall(result?.shortfall)
  } catch (err) {
    error = err
  }

  const job_success = Boolean(
    !error || error instanceof Errors.EmptyPoachingClaims
  )
  if (!job_success) {
    console.log(error)
  }

  await report_job({
    job_type: job_types.CLAIMS_POACH,
    job_reason: error ? error.message : null,
    job_success
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}
