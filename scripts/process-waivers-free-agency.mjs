import { Errors } from '#libs-shared'
import { waiver_types } from '#constants'
import { job_types } from '#libs-shared/job-constants.mjs'
import { current_season } from '#libs-shared/constants/season-constants.mjs'
import { report_job, get_waiver_by_id, throw_if_shortfall } from '#libs-server'
import db from '#db'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import processActiveWaivers from './process-waivers-free-agency-active.mjs'
import processPracticeWaivers from './process-waivers-free-agency-practice.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .option('wid', {
      alias: 'waiver-id',
      describe: 'Process a specific waiver by ID',
      type: 'string'
    })
    .option('daily', {
      describe: 'Run daily waivers',
      type: 'boolean'
    }).argv
}

const run_active = async ({ daily = false }) => {
  // Pre-snapshot: leagues with pending active waivers before the run
  const pre_rows = await db('waivers')
    .select('lid')
    .whereNull('processed')
    .whereNull('cancelled')
    .where('type', waiver_types.FREE_AGENCY)
    .groupBy('lid')
  const pre_league_ids = new Set(pre_rows.map((r) => r.lid))

  let error
  try {
    await processActiveWaivers({ daily })
  } catch (err) {
    error = err
  }

  // processActiveWaivers silently returns (no throw) under two gating
  // conditions that must not register as shortfall: regular-season waiver
  // period (full cohort runs only off-period) and offseason non-daily ticks.
  // Mirror them here so a no-op tick with pending waivers does not alert.
  const is_inner_gated_skip =
    (current_season.isRegularSeason && current_season.isWaiverPeriod) ||
    (!current_season.isRegularSeason && !daily)

  // Oracle: if the empty-queue sentinel was thrown, or if pre-snapshot showed
  // nothing pending, this was a legitimate no-op — skip the shortfall check.
  // Otherwise verify that every league that had pending waivers going in now
  // has at least one waiver that transitioned out of unprocessed state.
  let shortfall_error = null
  const is_legitimate_noop =
    error instanceof Errors.EmptyFreeAgencyWaivers ||
    error instanceof Errors.NotRegularSeason ||
    is_inner_gated_skip ||
    pre_league_ids.size === 0

  if (!error && !is_legitimate_noop && pre_league_ids.size > 0) {
    const post_rows = await db('waivers')
      .select('lid')
      .whereNull('processed')
      .whereNull('cancelled')
      .where('type', waiver_types.FREE_AGENCY)
      .whereIn('lid', Array.from(pre_league_ids))
      .groupBy('lid')
    const post_league_ids = new Set(post_rows.map((r) => r.lid))

    // Leagues where nothing moved: pre-count > 0 and post still has all pending
    const stuck_leagues = []
    for (const lid of pre_league_ids) {
      if (post_league_ids.has(lid)) {
        stuck_leagues.push(lid)
      }
    }

    try {
      throw_if_shortfall(
        stuck_leagues.length > 0
          ? `active free agency waivers remain unprocessed after run for league(s): ${stuck_leagues.join(', ')}`
          : null
      )
    } catch (e) {
      shortfall_error = e
    }
  }

  const effective_error = shortfall_error || error

  const job_success = Boolean(
    !effective_error ||
      effective_error instanceof Errors.EmptyFreeAgencyWaivers ||
      effective_error instanceof Errors.NotRegularSeason
  )

  if (!job_success) {
    console.log(effective_error)
  }

  await report_job({
    job_type: job_types.CLAIMS_WAIVERS_ACTIVE,
    job_success,
    job_reason: effective_error ? effective_error.message : null
  })
}

const run_practice = async ({ daily = false }) => {
  // Pre-snapshot: leagues with pending practice waivers before the run
  const pre_rows = await db('waivers')
    .select('lid')
    .whereNull('processed')
    .whereNull('cancelled')
    .where('type', waiver_types.FREE_AGENCY_PRACTICE)
    .groupBy('lid')
  const pre_league_ids = new Set(pre_rows.map((r) => r.lid))

  let error = null
  try {
    await processPracticeWaivers({ daily })
  } catch (err) {
    error = err
  }

  // processPracticeWaivers silently returns (no throw) under three gating
  // conditions that must not register as shortfall: after the final NFL week,
  // offseason non-daily ticks, and regular-season waiver period.
  const is_inner_gated_skip =
    current_season.week > current_season.finalWeek ||
    (!current_season.isRegularSeason && !daily) ||
    (current_season.isRegularSeason && current_season.isWaiverPeriod)

  // Oracle: if the empty-queue sentinel was thrown, or if pre-snapshot showed
  // nothing pending, this was a legitimate no-op — skip the shortfall check.
  // Otherwise verify that every league that had pending waivers going in now
  // has at least one waiver that transitioned out of unprocessed state.
  let shortfall_error = null
  const is_legitimate_noop =
    error instanceof Errors.EmptyPracticeSquadFreeAgencyWaivers ||
    is_inner_gated_skip ||
    pre_league_ids.size === 0

  if (!error && !is_legitimate_noop && pre_league_ids.size > 0) {
    const post_rows = await db('waivers')
      .select('lid')
      .whereNull('processed')
      .whereNull('cancelled')
      .where('type', waiver_types.FREE_AGENCY_PRACTICE)
      .whereIn('lid', Array.from(pre_league_ids))
      .groupBy('lid')
    const post_league_ids = new Set(post_rows.map((r) => r.lid))

    // Leagues where nothing moved: pre-count > 0 and post still has all pending
    const stuck_leagues = []
    for (const lid of pre_league_ids) {
      if (post_league_ids.has(lid)) {
        stuck_leagues.push(lid)
      }
    }

    try {
      throw_if_shortfall(
        stuck_leagues.length > 0
          ? `practice squad free agency waivers remain unprocessed after run for league(s): ${stuck_leagues.join(', ')}`
          : null
      )
    } catch (e) {
      shortfall_error = e
    }
  }

  const effective_error = shortfall_error || error

  const job_success = Boolean(
    !effective_error ||
      effective_error instanceof Errors.EmptyPracticeSquadFreeAgencyWaivers
  )

  if (!job_success) {
    console.log(effective_error)
  }

  await report_job({
    job_type: job_types.CLAIMS_WAIVERS_PRACTICE,
    job_success,
    job_reason: effective_error ? effective_error.message : null
  })
}

const process_specific_waiver = async (waiver_id) => {
  let error
  try {
    const waiver = await get_waiver_by_id(waiver_id)

    if (waiver.waiver_type === waiver_types.FREE_AGENCY) {
      await processActiveWaivers({ daily: false, wid: waiver_id })
    } else if (waiver.waiver_type === waiver_types.FREE_AGENCY_PRACTICE) {
      await processPracticeWaivers({ daily: false, wid: waiver_id })
    } else {
      throw new Error(`Unsupported waiver type: ${waiver.waiver_type}`)
    }
  } catch (err) {
    error = err
  }

  const job_success = Boolean(!error)
  if (!job_success) {
    console.log(error)
  }

  const job_type = error
    ? null
    : error instanceof Error && error.message.includes('FREE_AGENCY_PRACTICE')
      ? job_types.CLAIMS_WAIVERS_PRACTICE
      : job_types.CLAIMS_WAIVERS_ACTIVE

  if (job_type) {
    await report_job({
      job_type,
      job_success,
      job_reason: error ? error.message : null
    })
  }
}

const main = async () => {
  const argv = initialize_cli()
  if (argv.wid) {
    await process_specific_waiver(argv.wid)
  } else {
    const daily = argv.daily
    await run_active({ daily })
    await run_practice({ daily })
  }

  process.exit()
}

main()
