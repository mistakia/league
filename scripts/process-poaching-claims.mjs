import dayjs from 'dayjs'
import debug from 'debug'

import db from '#db'
import { Errors, should_block_poach_processing } from '#libs-shared'
import { current_season } from '#constants'
import {
  processPoach,
  report_job,
  is_main,
  throw_if_shortfall
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

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

const log = debug('process:claims')
if (process.env.NODE_ENV !== 'test') {
  debug.enable('process:claims')
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

  if (current_season.isRegularSeason) {
    // check if currently between Saturday 6pm and Tuesday 3pm (EST)
    if (should_block_poach_processing(now)) {
      // do not process any claims during this window
      return { shortfall: null }
    }
  }

  for (const claim of claims) {
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
  // A paused league's claims are held ON PURPOSE, so the same filter the work
  // query uses is applied here -- otherwise the hold trips the very detector
  // that exists to catch claims being silently skipped.
  const remaining = await exclude_paused_leagues(
    db('poaches')
      .where('submitted', '<', cutoff)
      .whereNull('processed')
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
