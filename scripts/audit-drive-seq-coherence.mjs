import debug from 'debug'

import db from '#db'
import { is_main, report_job } from '#libs-server'
import { get_half } from '#libs-server/play-enrichment/fixed-drive-enrichment.mjs'
import { is_administrative_play } from '#libs-server/play-enrichment/enrichment-helpers.mjs'
import { create_logger } from '#libs-shared/log.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('audit-drive-seq-coherence')
debug.enable('audit-drive-seq-coherence')

const signal_log = create_logger('audit-drive-seq-coherence', {
  service: 'league-host'
})

// drive_sequence numbering is game-continuous everywhere in this system: nflfastR's
// fixed_drive, NFL's driveSequenceNumber, Sportradar, and (since the 2026-07
// fix) the fixed-drive enrichment fallback all number 1..N across a whole game
// rather than restarting each half. Five consumers depend on it -- the
// `${esbid}_${drive_sequence}` key in drive-play-count-enrichment.mjs, three
// data-views rate-type denominators, and one team-stats column definition --
// and all five silently merge two drives into one when the invariant breaks.
//
// This defect produced wrong numbers rather than missing ones, so exit codes
// and output freshness were blind to it for as long as it existed. The oracle
// therefore measures the invariant directly.
//
// Contiguity (values forming an unbroken 1..N) is deliberately NOT asserted. It
// measures play-coverage gaps rather than the numbering invariant: five games
// including 2004091200 have legitimately non-contiguous drive_sequence because plays
// are missing from the feed, and folding that in would leave the check
// permanently red on games that are not broken.
//
// Baselines below are known-bad counts as of 2026-07-24. The check signals only
// when a class exceeds its baseline, so a known backlog does not fire every
// week and train the operator to ignore it, while genuinely new corruption
// still surfaces. LOWER THESE as repairs land -- a baseline left stale after a
// repair silently re-admits the same volume of corruption.
const KNOWN_VIOLATION_BASELINE = {
  // Was 48 games (2025: 32 PRE, 13 POST, 3 REG) where half 2 restarted
  // numbering at 1. Repaired 2026-07-24 by
  // db/adhoc/2026-07-24-repair-drive-seq-game-continuity.sql: 9,119 rows
  // renumbered across all 48, 1,174 true drives recovered, verified 0 remaining
  // by this auditor against production. At 0 the class is now a real gate --
  // any future restart game fails this check immediately.
  restart_at_1: 0,
  // Was 22 games carrying a mixed-authority splice: enrichment-written values
  // interleaved among source-numbered plays. A renumber does not fix these.
  // Repaired 2026-07-28 by
  // db/adhoc/2026-07-25-repair-drive-seq-mixed-authority-splice.sql, which
  // carries forward the neighboring source-supplied anchor: 16 of 22 resolved.
  //
  // Lowered from 6 to 3 on 2026-08-16. The residual was never 6: this check
  // counted administrative markers as drive members until that date, and three
  // of the six carried no cross-half real play at all -- 2001092311 and
  // 2026010300 are an END QUARTER 2 marker holding the next drive's number,
  // and 2021101013 is a weather-suspension COMMENT pair (the game was
  // suspended and resumed in half 2). They were misfiled as corruption in the
  // 2026-07-28 round and need no repair.
  //
  // The genuine 3 (2014110209, 2023121005, 2025101902) each carry a real play
  // on both sides of halftime under one drive_sequence -- isolated single-anchor
  // corruption, a half-1 drive with a stray half-2 extra point or rush. These
  // are real merged drives and remain open for repair.
  other: 3
}

/**
 * Classify every game in a set of play rows against the cross-half invariant.
 *
 * Pure -- no database access, no signal emission, no process exit -- so the
 * same predicate the weekly job runs against production can be exercised
 * directly from a test fixture.
 *
 * The invariant: for any game, the number of distinct (esbid, drive_sequence) pairs
 * must equal the number of distinct (esbid, half, drive_sequence) triples. They
 * diverge exactly when one drive_sequence value spans both halves, which is what
 * makes the drive key address two drives at once.
 *
 * @param {Array} rows - Rows carrying esbid, quarter, and drive_sequence
 * @returns {Object} games_checked, violations, violation_counts_by_class
 */
export const classify_drive_seq_coherence = (rows) => {
  const games = new Map()

  for (const row of rows) {
    if (row.drive_sequence === null || row.drive_sequence === undefined)
      continue
    if (row.quarter === null || row.quarter === undefined) continue
    // An administrative marker is not a drive and does not confer half
    // membership. NFL's feed stamps END QUARTER 2 with the sequence of the
    // drive about to start, which puts a half-2 drive number on a half-1 row
    // and diverges the two counts below with no real drive merged. Excluding
    // them is what separates a boundary artifact from a genuine merge.
    if (is_administrative_play(row)) continue

    if (!games.has(row.esbid)) {
      games.set(row.esbid, {
        drive_seqs: new Set(),
        half_drive_seqs: new Set(),
        first_half_max: null,
        second_half_min: null
      })
    }

    const game = games.get(row.esbid)
    // The half rule is imported from the enrichment rather than restated, so
    // the auditor and the writer can never disagree about where halftime is.
    const half = get_half(row)

    game.drive_seqs.add(row.drive_sequence)
    game.half_drive_seqs.add(`${half}_${row.drive_sequence}`)

    if (half === 1) {
      game.first_half_max = Math.max(
        game.first_half_max ?? -Infinity,
        row.drive_sequence
      )
    } else {
      game.second_half_min = Math.min(
        game.second_half_min ?? Infinity,
        row.drive_sequence
      )
    }
  }

  const violations = []

  for (const [esbid, game] of games.entries()) {
    if (game.drive_seqs.size === game.half_drive_seqs.size) continue

    // A half-2 sequence starting at 1 under a half-1 max above 1 is the
    // signature of a per-half counter reset. Those games are renumberable,
    // because only the numbering restarted -- the drive boundaries within each
    // half are correct. Anything else is a different mechanism and needs its
    // own diagnosis, so the two are reported apart.
    const violation_class =
      game.first_half_max > 1 && game.second_half_min === 1
        ? 'restart_at_1'
        : 'other'

    violations.push({
      esbid,
      violation_class,
      first_half_max: game.first_half_max,
      second_half_min: game.second_half_min,
      distinct_drive_seqs: game.drive_seqs.size,
      distinct_half_drive_seqs: game.half_drive_seqs.size
    })
  }

  const violation_counts_by_class = { restart_at_1: 0, other: 0 }
  for (const { violation_class } of violations) {
    violation_counts_by_class[violation_class] += 1
  }

  return {
    games_checked: games.size,
    violations,
    violation_counts_by_class
  }
}

/**
 * Read the distinct (esbid, quarter, drive_sequence) triples from nfl_plays and classify
 * them. One row per drive per quarter -- roughly 200k rows, not 1.5M plays.
 */
export const find_drive_seq_coherence_violations = async () => {
  // `is_deleted is not true` rather than `is_deleted = false`: the column is
  // nullable and roughly ten games' worth of rows carry NULL. The enrichment's
  // own should_count_play tests JS truthiness, so NULL counts as not-deleted
  // there; `is_deleted = false` here would silently exclude those rows and
  // undercount.
  // play_type_nfl / play_type / is_passing_play / is_rushing_play are here for
  // is_administrative_play, which decides whether a row confers half
  // membership. They widen the distinct set beyond one row per drive per
  // quarter, but only by the handful of play shapes each drive contains.
  const rows = await db('nfl_plays')
    .distinct(
      'esbid',
      'quarter',
      'drive_sequence',
      'play_type_nfl',
      'play_type',
      'is_passing_play',
      'is_rushing_play'
    )
    .whereNotNull('drive_sequence')
    .whereNotNull('quarter')
    .whereRaw('is_deleted is not true')

  // Oracle: assert the query actually resolved something. A renamed column or a
  // predicate that stopped matching would otherwise leave every game trivially
  // coherent and the check permanently, silently green.
  if (!rows.length) {
    throw new Error(
      'no drive_sequence rows resolved from nfl_plays; coherence check cannot assert anything'
    )
  }

  return classify_drive_seq_coherence(rows)
}

const audit_drive_seq_coherence = async () => {
  const { games_checked, violations, violation_counts_by_class } =
    await find_drive_seq_coherence_violations()

  log(
    `Checked ${games_checked} games: ${violations.length} carry a drive_sequence value spanning both halves`
  )
  log(
    `  restart_at_1: ${violation_counts_by_class.restart_at_1} (baseline ${KNOWN_VIOLATION_BASELINE.restart_at_1})`
  )
  log(
    `  other: ${violation_counts_by_class.other} (baseline ${KNOWN_VIOLATION_BASELINE.other})`
  )

  const regressions = Object.entries(KNOWN_VIOLATION_BASELINE)
    .filter(
      ([violation_class, baseline]) =>
        violation_counts_by_class[violation_class] > baseline
    )
    .map(([violation_class, baseline]) => ({
      violation_class,
      baseline,
      observed: violation_counts_by_class[violation_class],
      new_esbids: violations
        .filter((violation) => violation.violation_class === violation_class)
        .map((violation) => violation.esbid)
    }))

  if (!regressions.length) {
    log('No drive_sequence coherence regression against the recorded baseline')
    return
  }

  const summary = regressions
    .map(
      ({ violation_class, baseline, observed }) =>
        `${violation_class} ${observed} > baseline ${baseline}`
    )
    .join('; ')

  const emitted = signal_log.error(
    new Error(
      `drive_sequence cross-half coherence regressed (${summary}). A drive_sequence value spanning both halves makes the esbid+drive_sequence drive key address two drives at once, inflating per-drive rate denominators and corrupting drive_play_count.`
    ),
    {
      severity: 'high',
      context: {
        games_checked,
        violation_counts_by_class,
        baseline: KNOWN_VIOLATION_BASELINE,
        regressions
      }
    }
  )
  if (emitted?.promise) {
    await emitted.promise
  }

  throw new Error(`drive_sequence coherence regressed: ${summary}`)
}

const main = async () => {
  let error
  try {
    await audit_drive_seq_coherence()
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.AUDIT_DRIVE_SEQ_COHERENCE,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default audit_drive_seq_coherence
