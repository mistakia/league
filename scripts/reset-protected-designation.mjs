import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season, roster_slot_types } from '#constants'
import {
  is_main,
  getLeague,
  sendNotifications,
  has_league_notification_been_sent,
  claim_league_notification,
  report_job,
  throw_if_shortfall
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('reset-protected-designation')
debug.enable('reset-protected-designation')

const NOTIFICATION_TYPE_PROTECTIONS_EXPIRED =
  'practice_squad_protections_expired'

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
// The players whose designation is about to expire, deduped across the week 0
// and week 1 slices so the count is players rather than roster rows.
//
// Read BEFORE the reset, because the reset is what destroys the evidence: once
// the slots are PS/PSD nothing distinguishes a player who was protected this
// morning from one who never was.
const get_protected_pids = async ({ lid }) => {
  const rows = await db('rosters_players')
    .distinct('pid')
    .where({ lid, year: current_season.year })
    .whereIn('slot', Object.keys(PROTECTED_SLOTS).map(Number))

  return rows.map(({ pid }) => pid)
}

const format_protections_expired_message = ({ expired_count }) =>
  `The extension deadline has passed. Protected practice squad designations have expired — ${expired_count} practice squad ${
    expired_count === 1 ? 'player is' : 'players are'
  } now eligible to be poached.`

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

// Announce the expiry to the league's Discord/GroupMe channel, at most once per
// league per ext_date.
//
// The marker is CLAIMED before the send, inverting the order used by
// process-extensions.mjs and announce-free-agency-period-start.mjs. Those check
// the marker, send, then record it, which is at-least-once twice over: two runs
// can both read absent and both send, and the loser's unique violation is
// swallowed by the recorder rather than stopping it. For a channel every manager
// reads, a duplicate "protections expired" is worse than a missing one, because
// a missing one is alarmed and a duplicate is not.
//
// Claiming first makes this at-most-once -- the insert is the mutex, so exactly
// one caller sends -- and leaves the payload in the marker's metadata, so an
// announcement lost to a send failure can be reconstructed and posted by hand.
//
// Throws on send failure so the caller can turn it into a job error rather than
// dropping the announcement silently. Nothing retries a claimed send.
const announce_protections_expired = async ({
  lid,
  ext_date,
  expired_count,
  dry_run = false
}) => {
  const message = format_protections_expired_message({ expired_count })

  if (dry_run) {
    const already_announced = await has_league_notification_been_sent({
      lid,
      season_year: current_season.year,
      notification_type: NOTIFICATION_TYPE_PROTECTIONS_EXPIRED,
      event_timestamp: ext_date
    })
    log(
      already_announced
        ? `DRY RUN: league ${lid}: already announced for ext_date ${ext_date}`
        : `DRY RUN: league ${lid}: would announce: ${message}`
    )
    return
  }

  const claimed = await claim_league_notification({
    lid,
    season_year: current_season.year,
    notification_type: NOTIFICATION_TYPE_PROTECTIONS_EXPIRED,
    event_timestamp: ext_date,
    message,
    metadata: { ext_date, expired_count }
  })

  if (!claimed) {
    log(
      `league ${lid}: protections-expired notification already sent for ext_date ${ext_date}`
    )
    return
  }

  const league = await getLeague({ lid })
  await sendNotifications({ league, notifyLeague: true, message })

  log(`league ${lid}: announced: ${message}`)
}

// Reset protected designations for every hosted league whose extension deadline
// has passed, and announce the expiry once.
//
// The reset and the announcement get DIFFERENT guards on purpose, because they
// have different idempotency. The reset converges -- once the rows are PS/PSD
// there are none left in scope -- so it runs unconditionally on every due
// league and a missed cron firing self-heals on the next one indefinitely,
// needing neither a marker nor process-extensions.mjs' retry window. The send
// is a side effect that cannot be undone or re-derived, so it alone is gated on
// the league_notifications marker. Gating the reset on that marker too would be
// the harmful version: a marker written by a run whose UPDATE partially failed
// would strand the remaining rows protected forever.
//
// Returns { shortfall } -- null when no league was due or every due league was
// fully reset and announced, a descriptive string when a due league still holds
// protected rows or its announcement failed (silent partial-success).
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
  const announce_failures = []

  for (const { lid, ext_date } of eligible) {
    if (now < ext_date) {
      log(
        `league ${lid}: ext_date ${ext_date} not yet reached (now=${now}); skipping`
      )
      continue
    }

    due_leagues.push({ lid, ext_date })

    const expired_pids = await get_protected_pids({ lid })
    const updated = await reset_league({ lid, dry_run })
    log(
      `league ${lid}: extension deadline passed (ext_date=${ext_date}), ${updated} rows reset across ${expired_pids.length} players`
    )

    // Nothing expired means nothing to announce. Every league reaches its
    // deadline each year and most hold no protected players, so announcing
    // unconditionally would post an empty-handed message to every channel
    // annually. No marker is written either, so if this is a re-run after a
    // reset that already emptied the league, it stays silent for the same
    // reason rather than by accident.
    if (!expired_pids.length) {
      continue
    }

    try {
      await announce_protections_expired({
        lid,
        ext_date,
        expired_count: expired_pids.length,
        dry_run
      })
    } catch (err) {
      announce_failures.push(
        `league ${lid}: protections expired (ext_date=${ext_date}) but the announcement failed: ${err.message}`
      )
    }
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
  const shortfalls = [...announce_failures]
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
      // Manual override: reset immediately, no offseason or deadline gating and
      // no announcement. A hand-run reset is a repair, and posting to the league
      // channel is not something to trigger as a side effect of one -- the
      // scheduled run announces, or the operator posts deliberately.
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
