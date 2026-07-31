import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season, roster_slot_types } from '#constants'
import { is_main, report_job, throw_if_shortfall } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('reset-protected-designation')
debug.enable('reset-protected-designation')

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

// Constitution art. 11 (as amended by Amendment XI): a protected practice squad
// designation "can not be reversed and will expire at the extension deadline the
// following Offseason". So the trigger is the league's own `seasons.ext_date`,
// not a fixed calendar point and not the start of the offseason -- Amendment III
// originally expired protections at the start of the offseason and the earlier
// version of this script encoded that superseded rule.
const PROTECTED_SLOTS = {
  [roster_slot_types.PSP]: roster_slot_types.PS,
  [roster_slot_types.PSDP]: roster_slot_types.PSD
}

// Lift every protected designation held by a league in the current season year.
//
// Scope is the whole season year rather than week 0 alone. During the offseason
// the only populated slices are week 0 and the week-1 slice that
// generate-rosters materializes each night, and both carry the designation --
// the previous week-0-only form left week 1 protected until generate-rosters
// next propagated week 0 forward, so the live slice disagreed with the deadline
// for up to a day. generate-rosters' own orphan-slice oracle is what guarantees
// nothing beyond week 1 exists here.
const reset_league = async ({ lid, dry_run = false }) => {
  let updated = 0

  for (const [protected_slot, unprotected_slot] of Object.entries(
    PROTECTED_SLOTS
  )) {
    const query = db('rosters_players').where({
      lid,
      year: current_season.year,
      slot: Number(protected_slot)
    })

    if (dry_run) {
      const row = await query.clone().count().first()
      const count = Number(row?.count || 0)
      log(
        `DRY RUN: league ${lid}: would reset ${count} rows from slot ${protected_slot} to ${unprotected_slot}`
      )
      updated += count
      continue
    }

    const count = await query.update({ slot: unprotected_slot })
    log(
      `league ${lid}: reset ${count} rows from slot ${protected_slot} to ${unprotected_slot}`
    )
    updated += count
  }

  return updated
}

// Reset protected designations for every hosted league whose extension deadline
// has passed.
//
// No processed-marker and no retry window, unlike its sibling
// process-extensions.mjs: this operation converges. Once the rows are moved to
// PS/PSD there are none left in scope, so a re-run is a genuine no-op and a
// missed cron firing self-heals on the next one indefinitely rather than
// expiring out of a fixed window.
//
// Returns { shortfall } -- null when no league was due or every due league was
// fully reset, a descriptive string when a due league still holds protected
// rows after the run (silent partial-success).
const reset_protected_designations_for_due_leagues = async ({
  dry_run = false
} = {}) => {
  // The offseason gate is load-bearing and separate from the deadline gate.
  // A designation applied during the regular season of year N survives until
  // year N+1's deadline, and it lives on year N's week 1+ slices -- so acting
  // mid-season would expire designations a full season early.
  if (current_season.week !== 0) {
    log(`abort, week ${current_season.week} is not the offseason`)
    return { shortfall: null }
  }

  const now = Math.round(Date.now() / 1000)

  // A league with no configured ext_date is inside the extension window
  // indefinitely, matching is-before-extension-deadline.mjs, so it is never due.
  const eligible = await db('seasons')
    .join('leagues', 'leagues.uid', 'seasons.lid')
    .where({ 'seasons.year': current_season.year, 'leagues.hosted': true })
    .whereNotNull('seasons.ext_date')
    .select('seasons.lid', 'seasons.ext_date')

  const due_leagues = []

  for (const { lid, ext_date } of eligible) {
    if (now < ext_date) {
      log(
        `league ${lid}: ext_date ${ext_date} not yet reached (now=${now}); skipping`
      )
      continue
    }

    due_leagues.push({ lid, ext_date })
    const updated = await reset_league({ lid, dry_run })
    log(
      `league ${lid}: extension deadline passed (ext_date=${ext_date}), ${updated} designations reset`
    )
  }

  if (!due_leagues.length) {
    log('no leagues past their extension deadline')
    return { shortfall: null }
  }

  if (dry_run) {
    return { shortfall: null }
  }

  // Oracle: a league past its deadline must hold zero protected rows for the
  // season year. Distinct from the exit code -- a filter that silently matched
  // nothing updates 0 rows and exits 0 exactly as a correct no-op run does.
  const shortfalls = []
  for (const { lid, ext_date } of due_leagues) {
    const row = await db('rosters_players')
      .where({ lid, year: current_season.year })
      .whereIn('slot', Object.keys(PROTECTED_SLOTS).map(Number))
      .count()
      .first()
    const remaining = Number(row?.count || 0)
    if (remaining > 0) {
      shortfalls.push(
        `league ${lid}: ${remaining} protected practice squad rows remain after reset (ext_date=${ext_date})`
      )
    }
  }

  return { shortfall: shortfalls.length > 0 ? shortfalls.join('; ') : null }
}

const main = async () => {
  let error
  const argv = initialize_cli()
  const { lid, dry_run = false } = argv

  try {
    if (lid) {
      // Manual override: run immediately, no offseason or deadline gating.
      await reset_league({ lid, dry_run })
    } else {
      const { shortfall } = await reset_protected_designations_for_due_leagues({
        dry_run
      })
      throw_if_shortfall(shortfall)
    }
  } catch (err) {
    error = err
    console.log(error)
  }

  if (!dry_run) {
    await report_job({
      job_type: job_types.RESET_PROTECTED_DESIGNATION,
      error
    })
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default reset_protected_designations_for_due_leagues
