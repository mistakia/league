// @ts-check
import debug from 'debug'

import db from '#db'
import { is_main, report_job } from '#libs-server'
import { get_half } from '#libs-server/play-enrichment/fixed-drive-enrichment.mjs'
import { is_administrative_play } from '#libs-server/play-enrichment/enrichment-helpers.mjs'
import { create_logger } from '#libs-shared/log.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('audit-drive-seq-coherence')
enable_debug_namespaces('audit-drive-seq-coherence')

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
/**
 * @typedef {'restart_at_1' | 'other'} ViolationClass
 *
 * @typedef {object} Violation
 * @property {number} esbid
 * @property {ViolationClass} violation_class
 * @property {number} first_half_max
 * @property {number} second_half_min
 * @property {number} distinct_drive_seqs
 * @property {number} distinct_half_drive_seqs
 */

/** @type {Record<ViolationClass, number>} */
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
 * `quarter` is nullable, matching the column and matching what the body already
 * does with it (`if (row.quarter === null ...) continue`). Declaring it
 * non-null claimed a guarantee the caller's query cannot make and the function
 * does not need.
 *
 * @param {Array<{ esbid: number, quarter: number | null, drive_sequence: number | null }>} rows
 * @returns {{
 *   games_checked: number,
 *   violations: Violation[],
 *   violation_counts_by_class: Record<ViolationClass, number>
 * }}
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

  /** @type {Violation[]} */
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

  /** @type {Record<ViolationClass, number>} */
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

// The cross-half invariant above is about the NUMBERING. Two other things about a
// drive can be wrong while the numbering is perfect, and this auditor was blind to
// both of them despite being the only gate written for the drive family.
//
// ORPHANED COUNT -- a row carrying drive_play_count with no drive_sequence. The
// count describes a drive the row does not belong to, so every consumer keyed on
// `${esbid}_${drive_sequence}` skips the row while any consumer reading the count
// off the play reads a number for nothing. It is the residue shape a renumber
// leaves behind, which is exactly what the numbering check cannot see: the rows it
// examines are the ones that HAVE a drive_sequence.
//
// UNBOUNDED YARDS -- a drive cannot gain or lose more than the length of the field.
// drive_yards reads within [-99, 99] in every season of the feed's history except
// one, and the out-of-bound rows are the visible edge of a meaning change rather
// than a handful of bad values. A bound is the cheapest possible assertion and
// nothing was making it.
//
// Both are counted in ROWS rather than games: they are per-row properties, and a
// game-level count would hide 800 rows behind a dozen games.
/**
 * @typedef {'orphaned_drive_play_count' | 'out_of_bound_drive_yards'} AttributeClass
 *
 * @typedef {Record<AttributeClass, number>} AttributeTotals
 *
 * @typedef {{ season_year: number } & AttributeTotals} AttributeSeason
 */

/** @type {AttributeTotals} */
const KNOWN_DRIVE_ATTRIBUTE_BASELINE = {
  // 30 rows as of 2026-09-05: 19 in 2013 and 11 in 2021, pre-existing residue with
  // no owner. The 803 rows in 2025 are NOT baselined -- they belong to
  // repair-2025-drive-block and this check is red until that repair lands, which
  // is the point. LOWER THIS as repairs land.
  orphaned_drive_play_count: 30,
  // Zero everywhere in 27 seasons except 170 rows in 2025, same repair.
  out_of_bound_drive_yards: 0
}

const DRIVE_YARDS_BOUND = 99

/**
 * Count the two per-row drive-attribute violations, per season so a regime change
 * in one season is visible rather than averaged into 27 of them.
 *
 * @returns {Promise<{ totals: AttributeTotals, by_season: AttributeSeason[] }>}
 */
export const find_drive_attribute_violations = async () => {
  const result = await db.raw(
    `SELECT season_year,
            count(*) FILTER (
              WHERE drive_play_count IS NOT NULL AND drive_sequence IS NULL
            ) AS orphaned_drive_play_count,
            count(*) FILTER (
              WHERE drive_yards > ? OR drive_yards < ?
            ) AS out_of_bound_drive_yards,
            count(*) AS rows_scanned
     FROM nfl_plays
     WHERE is_deleted IS NOT TRUE
     GROUP BY season_year
     ORDER BY season_year`,
    [DRIVE_YARDS_BOUND, -DRIVE_YARDS_BOUND]
  )

  // Same oracle as the coherence query: a predicate that stopped matching would
  // otherwise report zero violations over zero rows and read as clean.
  /** @type {Array<Record<string, unknown>>} */
  const raw_rows = result.rows
  const rows_scanned = raw_rows.reduce(
    (/** @type {number} */ sum, row) => sum + Number(row.rows_scanned),
    0
  )
  if (!rows_scanned) {
    throw new Error(
      'no nfl_plays rows resolved; drive attribute check cannot assert anything'
    )
  }

  /** @type {AttributeSeason[]} */
  const by_season = raw_rows
    .map((row) => ({
      season_year: Number(row.season_year),
      orphaned_drive_play_count: Number(row.orphaned_drive_play_count),
      out_of_bound_drive_yards: Number(row.out_of_bound_drive_yards)
    }))
    .filter(
      (row) =>
        row.orphaned_drive_play_count > 0 || row.out_of_bound_drive_yards > 0
    )

  return {
    totals: {
      orphaned_drive_play_count: by_season.reduce(
        (/** @type {number} */ sum, row) => sum + row.orphaned_drive_play_count,
        0
      ),
      out_of_bound_drive_yards: by_season.reduce(
        (/** @type {number} */ sum, row) => sum + row.out_of_bound_drive_yards,
        0
      )
    },
    by_season
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
  const { totals: attribute_totals, by_season: attribute_by_season } =
    await find_drive_attribute_violations()

  log(
    `Checked ${games_checked} games: ${violations.length} carry a drive_sequence value spanning both halves`
  )
  log(
    `  restart_at_1: ${violation_counts_by_class.restart_at_1} (baseline ${KNOWN_VIOLATION_BASELINE.restart_at_1})`
  )
  log(
    `  other: ${violation_counts_by_class.other} (baseline ${KNOWN_VIOLATION_BASELINE.other})`
  )
  log(
    `  orphaned drive_play_count rows: ${attribute_totals.orphaned_drive_play_count} (baseline ${KNOWN_DRIVE_ATTRIBUTE_BASELINE.orphaned_drive_play_count})`
  )
  log(
    `  drive_yards outside +/-${DRIVE_YARDS_BOUND}: ${attribute_totals.out_of_bound_drive_yards} (baseline ${KNOWN_DRIVE_ATTRIBUTE_BASELINE.out_of_bound_drive_yards})`
  )
  for (const season of attribute_by_season) {
    log(
      `    ${season.season_year}: ${season.orphaned_drive_play_count} orphaned, ${season.out_of_bound_drive_yards} out of bound`
    )
  }

  const regressions = /** @type {[ViolationClass, number][]} */ (
    Object.entries(KNOWN_VIOLATION_BASELINE)
  )
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

  const attribute_regressions = /** @type {[AttributeClass, number][]} */ (
    Object.entries(KNOWN_DRIVE_ATTRIBUTE_BASELINE)
  )
    .filter(
      ([violation_class, baseline]) =>
        attribute_totals[violation_class] > baseline
    )
    .map(([violation_class, baseline]) => ({
      violation_class,
      baseline,
      observed: attribute_totals[violation_class]
    }))

  if (!regressions.length && !attribute_regressions.length) {
    log('No drive coherence regression against the recorded baselines')
    return
  }

  const summary = [...regressions, ...attribute_regressions]
    .map(
      ({ violation_class, baseline, observed }) =>
        `${violation_class} ${observed} > baseline ${baseline}`
    )
    .join('; ')

  const emitted = signal_log.error(
    new Error(
      `drive coherence regressed (${summary}). A drive_sequence value spanning both halves makes the esbid+drive_sequence drive key address two drives at once; an orphaned drive_play_count describes a drive its own row does not belong to; a drive_yards value outside the field length cannot mean what the column means.`
    ),
    {
      severity: 'high',
      context: {
        games_checked,
        violation_counts_by_class,
        baseline: KNOWN_VIOLATION_BASELINE,
        regressions,
        attribute_totals,
        attribute_by_season,
        attribute_baseline: KNOWN_DRIVE_ATTRIBUTE_BASELINE,
        attribute_regressions
      }
    }
  )
  if (emitted?.promise) {
    await emitted.promise
  }

  throw new Error(`drive coherence regressed: ${summary}`)
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
