// @ts-check
/*
  The registered data checks.

  A check is a row here: a query, a grain, an optional precondition, a threshold
  and a repair command. One runner executes them all
  (scripts/run-data-checks.mjs), one classifier grades them
  (libs-server/data-check.mjs), and one file parks every suppressed finding
  (db/checks/parked.json).

  ## Adding a check

  Add an object with every field below. There is no README and no second prose
  surface: the design rules are canonical in
  user:guideline/software/design-data-checks.md and a second copy beside them
  drifts within a quarter.

    check_id              stable; it becomes the pinned signal fingerprint, so
                          renaming one orphans its open signals
    invariant             what must hold, and why no other oracle sees it
    grain                 the columns the rows group by, in key order
    rows                  async fn returning the grain columns plus `numerator`
                          and `denominator`
    precondition          OPTIONAL per-row gate: is this row gradeable at all?
                          REQUIRED where the check compares against a reference
    min_rate / max_count  exactly one
    calibration           REQUIRED, validated non-empty at load: the observed
                          distribution and the reading that is a real defect
    min_gradeable_units   detector-health floor on the ROW count -- fewer THROWS
    min_denominator       OPTIONAL detector-health floor on the smallest graded
                          population. REQUIRED where the row count is fixed by
                          construction and cannot fall
    repair_command        goes in the finding message

  ## Two rules that are easy to get wrong

  Every `rows` function MUST return `denominator` as the population it SCANNED,
  including on a `max_count` check where `numerator` is the violation count.
  Without it the detector-health floor fires precisely when the corpus is clean.

  A check whose result set is a FIXED SIZE -- one sentinel row per child table,
  one aggregate row -- MUST declare `min_denominator` as well. Its row count is
  a constant, so `min_gradeable_units` is met no matter how empty the scan is,
  and only the denominator moves. Reading the row count alone is what let an
  emptied table report zero findings, pass its floor and resolve its own
  findings signal.

  Adding or removing a check also breaks test/data-checks.spec.mjs, which pins
  the registry LENGTH ("holds N checks with unique ids"). That is deliberate --
  it makes an accidental drop visible -- but it fails in a file your change
  does not name, so update the count in the same commit.

  Calibrate on the GAP between normal and defective, never on the worst normal
  reading, and re-measure immediately before changing a threshold. Every figure
  in a `calibration` string below is a reading taken at one instant against a
  corpus other people are actively repairing.
*/

import db from '#db'

import { recompute_route_share } from '#libs-server'
import { pfr_gamelog_agreement_rows } from '#libs-server/pfr-gamelog-agreement.mjs'
import { erased_role_attribution_by_play_type } from '#libs-server/erased-role-attribution.mjs'
import {
  game_prop_column_resolution_rows,
  game_prop_line_differential_rows
} from '#libs-server/game-prop-column-resolution.mjs'
import { scoring_format_gamelog_completeness_rows } from '#libs-server/scoring-format-gamelog-completeness.mjs'
import { find_duplicate_person_row_pairs } from '#libs-server/duplicate-person-row-pairs.mjs'

// The four gamelog child tables. Generic over the parent-child edge rather than
// receiving-specific, because a receiving-only detector missed the 30 defender
// rows a sibling repair found.
const GAMELOG_CHILD_TABLES = [
  'player_receiving_gamelogs',
  'player_rushing_gamelogs',
  'player_passing_gamelogs',
  'player_defender_gamelogs'
]

// The ADP sources we run an importer for, with the number of distinct
// adp_format rows each vendor publishes. DECLARED, never derived from the table
// being graded: a derived expectation defines health as whatever landed, which
// is precisely the reading that let a whole season of missing sources look
// normal.
//
// `expected_formats` is a MINIMUM. A vendor adding a format is not a finding;
// dropping one is. DRAFTKINGS is deliberately absent — the data-view field
// offers it as an adp_source_id and no importer has ever existed for it, so
// expecting rows would raise a finding no repair could clear.
const EXPECTED_ADP_SOURCES = [
  { source_id: 'SLEEPER', first_season: 2024, expected_formats: 12 },
  { source_id: 'RTS', first_season: 2024, expected_formats: 3 },
  { source_id: 'CBS', first_season: 2024, expected_formats: 2 },
  { source_id: 'MFL', first_season: 2024, expected_formats: 2 },
  { source_id: 'ESPN', first_season: 2024, expected_formats: 1 },
  { source_id: 'YAHOO', first_season: 2024, expected_formats: 1 },
  // NFL.com shut its fantasy product down and moved to ESPN; the importer was
  // retired in league b12b2dcb4 on 2026-08-14, after it had already written the
  // 2026 season. `last_season` stops a retired source from raising a finding
  // every year forever while keeping the seasons it DID cover graded.
  {
    source_id: 'NFL',
    first_season: 2024,
    last_season: 2026,
    expected_formats: 1
  },
  // Underdog best ball runs from base-storage rather than the league host, on
  // the hourly `ln-bestball-adp` binfile, and started with the 2026 season.
  { source_id: 'UNDERDOG', first_season: 2026, expected_formats: 2 }
]

// A season becomes gradeable on August 1 of its own year. Every vendor
// publishes by late July and the importers' crontab window is June through
// August, so before that date an empty season is early rather than missing --
// the seasonal-blind-window trap, expressed as a per-row precondition instead
// of a short-circuit that would make the check vacuous.
const adp_season_window_is_open = (/** @type {number} */ season_year) => {
  const now = new Date()
  const window_open = new Date(Date.UTC(season_year, 7, 1))
  return now >= window_open
}

// Seasons the PFR cache holds completely enough to be worth asking about. The
// precondition rejects a week the reference cannot cover, so listing a thin
// season costs an un-gradeable report rather than a false finding.
const PFR_GRADED_SEASONS = [2022, 2024, 2025]

const registry = [
  {
    check_id: 'pfr-gamelog-agreement',
    invariant:
      'Our per-week stat totals equal Pro Football Reference’s for every week both corpora cover completely. No internal oracle can see this: an importer grading its own write can only compare against what it received.',
    grain: ['season_year', 'week', 'stat'],
    rows: () =>
      pfr_gamelog_agreement_rows({ season_years: PFR_GRADED_SEASONS }),
    precondition: (/** @type {Record<string, any>} */ row) =>
      row.our_games > 0 && row.reference_games === row.our_games,
    min_rate: 1.0,
    calibration:
      '2022 grades 221 units across 17 admitted weeks and 13 stat fields: median 1.0000, zero below 0.99, minimum 0.9984 at week 8 receptions (635 ours against 636). 2024 weeks 1-2 grade at 26 units with 25 exactly 1.0000, read from the per-GAME box scores because the cache holds no 2024 season file. 2025 admits one week of seven, which is the precondition working. WHAT THIS CHECK CAN AND CANNOT SEE: the precondition demands `reference_games === our_games`, and `our_games` counts the distinct games we hold gamelogs for — so a week where we are missing a WHOLE GAME fails the precondition and is reported un-gradeable, never as a finding. What it grades is disagreement WITHIN the games both sides cover: a missing or mis-attributed player row moves the ratio while the game count stays equal, which is the defect class this catches and the reason the grain is (season_year, week, stat) rather than the game. A prior version of this prose claimed a single missing game reads about 0.94 and is detectable; that is false against the shipped precondition, and simulating it confirms the week goes un-gradeable with zero findings. Whole-game absence is unowned by this registry — one such week costs 13 of about 260 gradeable units, nowhere near the floor, so it is invisible here rather than merely un-graded. min_rate is ONE-SIDED and this comparison is two-sided — a ratio above 1.0 passes silently, so the reference-completeness precondition is the only thing catching a reference that is BEHIND ours, and grading a partial 2025 without it produced ratios up to 5.5. FUMBLES_LOST IS THE ONE FIELD THAT ALWAYS SITS ABOVE 1.0, and it is left gradeable deliberately: measured 2026-08-14, every one of the 15 gradeable units exceeding the reference is fumbles_lost (2022 weeks 2-14 and 18, 2024 week 1, 2025 week 5), ours always the larger side, because PFR credits the fumbling player only where the recovering team gained possession while our feed counts every fumble the fumbling team did not recover. That definitional gap can only push OUR side up, which min_rate cannot see — so keeping the field costs nothing and preserves the direction that is a real defect, a week where we are MISSING lost fumbles. Parking it would have meant 15 entries repeating one reason, which is a baseline wearing an adjudication’s schema.',
    min_gradeable_units: 150,
    repair_command:
      'Identify the missing or mis-attributed PLAYER rows within the week — a whole missing game fails this check’s precondition and is reported un-gradeable rather than as this finding — then re-import: node scripts/import-plays-nflfastr.mjs --year <year>'
  },

  {
    check_id: 'nflfastr-dropback-coverage',
    invariant:
      'Every graded week carries is_qb_dropback on nearly all of its plays. The importer’s own match rate is season-grained, so a nine-game hole is about 2 percent of its denominator and can never breach any floor.',
    grain: ['season_year', 'week', 'season_type'],
    rows: async () =>
      db('nfl_plays')
        .select('season_year', 'week', 'season_type')
        .count('* as denominator')
        .select(db.raw('count(is_qb_dropback) as numerator'))
        .where('season_year', '>=', 1999)
        .whereIn('season_type', ['REG', 'POST'])
        .whereNotNull('week')
        .groupBy('season_year', 'week', 'season_type'),
    // A week below this is a scheduling artifact rather than a gradeable
    // population. Declared as a precondition rather than filtered out of
    // `rows`, because a filtered row enters neither the gradeable nor the
    // un-gradeable population and is reported NOWHERE -- scope discovered
    // rather than declared, which is the shape that reports "no problems found"
    // when the answer is "I found nothing to check". A partial import leaving a
    // week at 40 plays now surfaces as un-gradeable instead of vanishing.
    // Measured 2026-08-14: all 533 weeks clear this, the smallest at 163, so it
    // excludes nothing today.
    precondition: (/** @type {Record<string, any>} */ row) =>
      row.denominator >= 100,
    min_rate: 0.8,
    calibration:
      'The one threshold here that is a genuine TOLERANCE rather than a target: nflfastR does not enrich every play by design. Across 533 graded weeks measured 2026-08-14 the median is 0.9540 and the minimum is 0.8493, with zero weeks below the floor; the one real defect this was written for (2021 REG week 15, before repair) sat at 0.425. The floor is six points under the healthy minimum and thirty-seven above the defect — calibrated on the gap, not on the worst normal reading. PRE is excluded because nflfastR publishes REG and POST only, so grading it would put roughly 100 permanently-red weeks in front of the one that is real.',
    min_gradeable_units: 400,
    repair_command: 'node scripts/import-plays-nflfastr.mjs --year <year>'
  },

  {
    check_id: 'gamelog-orphans',
    invariant:
      'Every gamelog child row has a player_gamelogs parent. No foreign key constrains any of these four edges — zero information_schema constraints reference player_gamelogs — and an enforced one would be actively wrong, surfacing a player-conflation bug as a write-time feed failure and destroying real data on retraction.',
    grain: ['child_table', 'esbid', 'pid'],
    rows: async () => {
      const per_table = await Promise.all(
        GAMELOG_CHILD_TABLES.map(async (child_table) => {
          const [scanned] = await db(child_table).count('* as denominator')

          const orphans = await db(`${child_table} as c`)
            .select('c.pid', 'c.esbid')
            .leftJoin('player_gamelogs as g', function () {
              this.on('g.pid', 'c.pid').andOn('g.esbid', 'c.esbid')
            })
            .whereNull('g.pid')

          return { child_table, scanned: Number(scanned.denominator), orphans }
        })
      )

      // One row per child table when clean, one row per orphan when not, both
      // carrying the scanned population -- so an emptied predicate is
      // distinguishable from a healthy corpus.
      return per_table.flatMap(({ child_table, scanned, orphans }) =>
        orphans.length
          ? orphans.map((/** @type {Record<string, any>} */ row) => ({
              child_table,
              esbid: row.esbid,
              pid: row.pid,
              numerator: 1,
              denominator: scanned
            }))
          : [
              {
                child_table,
                esbid: null,
                pid: null,
                numerator: 0,
                denominator: scanned
              }
            ]
      )
    },
    max_count: 0,
    calibration:
      'Measured 2026-08-14: zero orphans against 269,481 child rows scanned (receiving 137,900, rushing 67,621, defender 60,090, passing 3,870). This is a REGRESSION detector over a clean population rather than a detector seeded with known debt — the 10 rows the plan carried were repaired by resolve-orphan-receiving-gamelogs and repair-name-match-play-stat-misattribution before this landed, so max_count 0 is a live invariant and not an aspiration. Grain includes pid because one esbid can carry two orphan rows for different players; (child_table, esbid) cannot separate them. REPORTS AND NEVER REMEDIATES: the obvious fix, deleting the orphan, was wrong for 46 of 169 rows in a previous instance and unrecoverable, because the same symptom means either a wrongly-removed parent or a wrongly-written child.',
    min_gradeable_units: 4,
    // The row count here is 4 when clean and only ever larger, so it can never
    // breach its own floor -- the denominator is the only number that moves.
    // Re-measured 2026-08-14: the smallest child table is
    // player_passing_gamelogs at 3,870 rows, and all four grow monotonically
    // with each season. 3,000 sits 22 percent under today's smallest and
    // enormously above the reading this exists to catch, which is a table
    // emptied to zero or near it.
    min_denominator: 3000,
    repair_command:
      'Determine per row whether the PARENT was wrongly retracted or the CHILD wrongly written — an independent oracle is required, and deletion is not the default. See user:task/league/remove-unsupported-derived-rows.md'
  },

  {
    check_id: 'route-share-unfilled',
    invariant:
      'Every player_receiving_gamelogs row carrying routes and usable dropback data has a route_share. 6,924 rows were null across 2020-2025 with both inputs present, and no existing oracle could see it.',
    grain: ['scope'],
    rows: async () => {
      // Graded by running the HEALER in dry mode rather than by a second
      // selector written to match it. A detector that re-derives its healer's
      // reference drifts from it, and the drift presents as a finding nobody
      // can reproduce with the repair command this check names.
      const result = await recompute_route_share({ dry_run: true })

      // `scanned`, never `candidates`: the candidate set is the rows still
      // MISSING a share, which is the violating population and drains to zero
      // as the repair succeeds. Reporting it as the denominator would make a
      // healthy corpus and a selector matching nothing read identically.
      return [
        {
          scope: 'all',
          numerator: result.updated,
          denominator: result.scanned,
          candidates: result.candidates,
          skipped_missing_dropbacks: result.skipped_missing_dropbacks,
          skipped_invalid_dropbacks: result.skipped_invalid_dropbacks
        }
      ]
    },
    max_count: 0,
    calibration:
      'Exact: any row the healer can fill right now is a row the recompute pass failed to reach, so the healthy reading is zero fillable against a non-zero SCANNED population. Measured 2026-08-14: 32,461 rows carry routes and 4 of them still lack a share. The denominator is the scanned figure and not the candidate count, because candidates are the violating rows and drain toward zero as the repair lands — a floor on that number would go red as a direct consequence of the pass succeeding, and a zero there is indistinguishable from a selector that has stopped matching anything. Grain is `all` rather than per-season because recompute_route_share returns global scalars with no season breakdown; delivering a per-season grain means either N calls or changing a healer shared with two other scripts, which is a separate change. The rows the healer SKIPS are deliberately not this finding — they are the upstream dropback gap that nflfastr-dropback-coverage owns, and counting them here would report one condition twice and leave this key permanently open.',
    min_gradeable_units: 1,
    // Always exactly one row, so the row-count floor is a tautology and the
    // denominator carries the whole signal. Re-measured 2026-08-14: 32,461
    // player_receiving_gamelogs rows carry routes. The population grows with
    // each NGS import and nothing retracts routes, so 30,000 sits about eight
    // percent under today's figure and far above the reading this exists to
    // catch, which is the healer's join breaking and selecting nothing.
    min_denominator: 30000,
    repair_command: 'node scripts/recompute-route-share.mjs'
  },

  {
    check_id: 'role-attribution-erased',
    invariant:
      'A nullified or two-point play the changelog shows once carried a passer still carries one — a _pid, or at minimum the _gsis it can be resolved from. No other oracle sees this: the residual monitor grades the OPPOSITE shape (_gsis present, _pid null), and the obvious repair for that reading is to clear the _gsis, which turns it green by deleting the last record of who the player was.',
    grain: ['play_type'],
    rows: async () => {
      // Graded through the same module a healer must import, so detector and
      // healer cannot drift into disagreeing about which rows are erased.
      const rows = await erased_role_attribution_by_play_type()
      return rows.map((row) => ({
        play_type: row.play_type,
        // `scanned` is every row the changelog shows was once attributed, not
        // the erased count. The erased population DRAINS as recovery lands, so
        // a floor on it would go red as a consequence of success and a zero
        // there could not be told apart from a join that stopped matching.
        numerator: row.erased,
        denominator: row.scanned,
        resolvable: row.resolvable,
        restored: row.restored
      }))
    },
    max_count: 0,
    calibration:
      'Exact: a row that once had a passer and now has neither a pid nor a gsis lost data, and the changelog holds the previous_value that proves it. Measured 2026-08-22: NOPL scans 3,279 once-attributed rows — 2,299 erased, 980 still resolvable, ZERO restored; CONV scans 166 and all 166 are erased. The contrast that calibrates it is PASS, which is deliberately OUT of scope: 5,457 of 5,458 cleared PASS rows were repopulated, so the same clear-and-rewrite cycle is transient there and a loss here. DIRECTION IS THE POINT: clearing a resolvable residual to satisfy the old monitor moves a row out of `resolvable` and into `numerator`, so the repair that greens that oracle reds this one. RUSH is out of scope for a second reason — deliberate clears of bogus passer stamps live there (five cleared 2026-08-22 under source bogus-passer-stamp-triage) and they are a repair, not a loss. This reads red from the day it lands and that is a correct reading of a known defect; per design-data-checks.md a finding rides a self-closing signal and does not fail the run. It does not contradict the rule about repairs that RAISE a count, because this one falls. The erased bucket is recoverable only from play_changelog.previous_value, since those rows have no surviving gsis for enrichment to resolve. RELATIONSHIP TO THE RESIDUAL MONITOR (cli/monitoring/check-league-role-pid-residual.sh): it is NOT superseded and must not be retired for this. The two grade opposite halves and move in opposite directions — it owns rows still resolvable, this owns rows past resolving — so retiring it would leave the resolvable half ungraded. Its three known weaknesses are ruled on here rather than inherited: the three-season lookback is DROPPED, because this check is bounded by changelog reach (2023 onward for role columns) instead of a rolling window; qb_pid coverage is NOT added, because qb_pid is a separate writer with no changelog rows and so has no erasure oracle at all; and its self-closing signal branch — a destructive repair resolving its own finding with no human in the loop — is the reason this check exists, since that same repair reds this one.',
    min_gradeable_units: 1,
    // Exactly two rows, fixed by construction, so the row-count floor is a
    // tautology and the denominator carries the whole signal. The scanned
    // population only ever GROWS (a clear is never un-recorded), so a reading
    // below 100 against today's smallest of 166 means the changelog join broke
    // or the column spelling moved, not that the corpus got healthier.
    min_denominator: 100,
    repair_command:
      'Restore from play_changelog.previous_value — these rows have no surviving _gsis, so re-running enrichment cannot reach them. See user:task/league/separate-play-role-attribution-from-countability.md. Do NOT clear a resolvable residual to make the role-pid monitor green; that moves rows INTO this finding.'
  },

  {
    check_id: 'duplicate-person-rows',
    invariant:
      'No person holds both a populated canonical `player` row and a near-empty shell row. Repaired six times across db/adhoc dedupe rounds. THIS CHECK IS THE DETECTOR — it surfaced the round 6 findings — so detection is not the gap; the gap is on the MERGE side. scripts/merge-duplicate-person-rows.mjs proves its own losslessness in-process through audit_player_row_merges, and that audit CANNOT be run after the fact (libs-server/audit-player-row-merge.mjs: reference conservation compares against per-table counts captured before the write). The dated-SQL path under db/adhoc runs outside that script and so outside that audit, and must therefore carry the equivalent proof in its own steps — which is what the shape named in repair_command exists to guarantee. Nothing mechanically enforces that it does.',
    grain: ['pid'],
    rows: async () => {
      // The pair predicate is shared with the repair that closes this class --
      // see libs-server/duplicate-person-row-pairs.mjs for why the two must not
      // hold separate copies. A shell can pair with more than one twin, so the
      // findings are the DISTINCT shells rather than the pairs.
      const pairs = await find_duplicate_person_row_pairs()
      const found = [...new Set(pairs.map((pair) => pair.shell_pid))]

      const [scanned] = await db('player').count({ count: '*' })
      const denominator = Number(scanned.count)

      return found.length
        ? found.map((/** @type {string} */ pid) => ({
            pid,
            numerator: 1,
            denominator
          }))
        : [{ pid: null, numerator: 0, denominator }]
    },
    max_count: 0,
    calibration:
      'Measured 2026-08-14: 24 candidate shell rows against 27,748 player rows scanned. The predicate is RECONSTRUCTED from the prose specification in the header of db/adhoc/2026-08-04-dedupe-duplicate-person-rows.sql — no dedupe round contains the sweep SQL, only a hardcoded merge_map — and validated by reproducing that round’s two arms in ratio rather than in absolute count: it measured 150 strict-college and 242 relaxed, today 14 and 24, both scaled together. It is sharply sensitive to the twin threshold: requiring the twin to hold TWO or more identifiers gives 24, one or more gives 60, and the round specifies two. The class RECURS BY CONSTRUCTION, which is why a sixth one-shot repair would not settle it: round 4 records that repairing two corrupt birth dates in round 3 made two further pairs agree on a date they had never agreed on, so each repair mints the next round’s findings and nothing watches in between. A finding here is a CANDIDATE for adjudication, never an automatic merge — fathers, sons and namesakes sit in the same predicate.',
    min_gradeable_units: 1,
    // Always exactly one row when clean, so the row-count floor is a tautology
    // and the denominator carries the whole signal. Re-measured 2026-08-14:
    // 27,748 player rows. The population grows with each draft class and the
    // only thing that shrinks it is this check's own merge repair, which
    // retires tens of rows a round rather than thousands, so 25,000 leaves ten
    // percent of headroom against a reading that would mean the table is gone.
    min_denominator: 25000,
    repair_command:
      'MOST FINDINGS HERE ARE NOT DUPLICATES — measured 2026-08-16, 19 of 24 were different people, overwhelmingly father/son and namesake pairs decades apart (Chickillo, Dorsett and Zordich Sr/Jr; Deacon Jones against a 2011 tackle). Adjudicate every pair on date_of_birth before merging anything (nfl_draft_year is corrupt on exactly these rows and cannot discriminate); a gap of more than a few years is a different person. Park those in db/checks/parked.json as adjudicated. Merge only the remainder, in a dated file under db/adhoc/ following the shape of 2026-08-29-dedupe-duplicate-person-rows-round-6.sql. Round 6 rather than round 5 because it generates the additive fill from the catalog as well as the re-point, and rather than round 4, whose hand-written column list names three columns a later conform renamed away and silently drops any column added since it was written. THE SHAPE IS THE AUDIT: because the dated-SQL path never runs audit_player_row_merges, the file itself has to prove the fold lossless, and round 6 does it in five steps that must all be carried forward — snapshot the rows about to be deleted (1), preserve their non-null values into player_changelog (2), re-point every referencing table off the catalog (6), assert nothing anywhere still references a row about to be deleted (7), and additively fill the survivor from the snapshot (9), with post-conditions on survivor and donor counts (10). Drop any of those and the merge is unaudited in the one direction that looks like success.'
  },

  {
    check_id: 'bare-bones-gsis-player-rows',
    invariant:
      'No `player` row carries a gsis id without a position, a height and a weight. The operator ruled the bare-bones row an anti-pattern on 2026-08-22 — a row with no biography cannot be deduplicated against, so it manufactures exactly the conflated identity audit-conflated-player-identity.mjs exists to unwind. Nothing enforced it: createPlayer refuses such a row, but a direct insert or a later importer relaxing its own field list would not be seen by any surface.',
    grain: ['pid'],
    rows: async () => {
      const { rows: found } = await db.raw(
        `select pid from player
         where gsis_player_id is not null
           and primary_position <> 'DST'
           and (primary_position is null or height_inches is null or weight_pounds is null)`
      )
      const [scanned] = await db('player')
        .whereNotNull('gsis_player_id')
        .andWhere('primary_position', '<>', 'DST')
        .count({ count: '*' })
      const denominator = Number(scanned.count)

      return found.length
        ? found.map((/** @type {Record<string, any>} */ row) => ({
            pid: row.pid,
            numerator: 1,
            denominator
          }))
        : [{ pid: null, numerator: 0, denominator }]
    },
    max_count: 0,
    calibration:
      'Measured 2026-08-23, immediately after scripts/repair-missing-player-gsis-ids.mjs attached 345 gsis ids and minted 619 rows: 0 findings against 17,600-odd gsis-bearing rows scanned. Zero is the CORRECT steady state here rather than a suspiciously clean one, and the reason is structural: height_inches is non-null on every row in the table, so this predicate has never had a match to find. That also means it cannot be falsified against live data — a zero here proves nothing on its own, and calling it a pass would be circular. It is falsified instead by running the identical predicate over a synthetic pair, one bare row and one complete, which is wired into repair-missing-player-gsis-ids as a pre-flight and must find exactly the bare one. Treat a finding as a writer defect, not a data gap: something minted a row this repo has no path to mint.',
    min_gradeable_units: 1,
    min_denominator: 15000,
    repair_command:
      'Do NOT fill the missing fields to clear the finding — that hides which writer produced the row. Find the writer first: player_changelog carries the source on every field it wrote, and libs-server/create-player.mjs is the only mint path for real players (scripts/seed-nfl-teams.mjs inserts DST pseudo-rows and is excluded here by primary_position). Then decide whether the row is a person we can source biography for, in which case fill it from a gsis-keyed source of truth, or a row that should never have existed, in which case collapse it with scripts/collapse-duplicate-minted-player-rows.mjs.'
  },

  {
    check_id: 'shared-birth-date-duplicate-player-rows',
    invariant:
      'No two `player` rows share a normalized short name AND an exact date of birth. This is the third duplicate class, and the two registered siblings are both blind to it: duplicate-person-rows requires the twin to hold ZERO external identifiers, and nickname-legal-name-duplicate-rows requires college AND draft year and excludes equal-name pairs by construction. It is also the class the identity-repair attach ladder could not see — a person holding no external id and no gamelog is invisible to both an id match and a name-and-team-season match, which is how 70 duplicate rows were minted on 2026-08-23 before this rung existed.',
    grain: ['pid', 'duplicate_pid'],
    rows: async () => {
      // The 0000-00-00 sentinel is excluded on BOTH sides. It is an absence
      // wearing a value, and thousands of rows carry it, so admitting it would
      // pair unrelated people by the thousand and bury the real class.
      const { rows: found } = await db.raw(
        `with keyed as (
          select pid, date_of_birth,
            lower(regexp_replace(
              regexp_replace(short_name, '[ ,]+(Jr|Sr|II|III|IV|V)[.]{0,1}[ ]*$', '', 'i'),
              '[^A-Za-z]', '', 'g')) as name_key
          from player
          where primary_position <> 'DST'
            and short_name is not null
            and date_of_birth is not null
            and date_of_birth::text not like '0000%'
        )
        select a.pid, b.pid as duplicate_pid
        from keyed a
        join keyed b
          on b.name_key = a.name_key
         and b.date_of_birth = a.date_of_birth
         and b.pid > a.pid`
      )

      const [scanned] = await db('player').count({ count: '*' })
      const denominator = Number(scanned.count)

      return found.length
        ? found.map((/** @type {Record<string, any>} */ row) => ({
            pid: row.pid,
            duplicate_pid: row.duplicate_pid,
            numerator: 1,
            denominator
          }))
        : [{ pid: null, duplicate_pid: null, numerator: 0, denominator }]
    },
    // A RATCHET, not an invariant. 39 pairs predate the 2026-08-23 identity
    // repair and adjudicating them is a separate exercise, so the threshold
    // holds the line at what was there rather than asserting a clean table.
    // Lower it as pairs are retired; never raise it.
    max_count: 39,
    calibration:
      'Measured 2026-08-23 across three readings on the same day, which is what makes the ratchet trustworthy: 39 pairs before the identity repair, 109 immediately after it minted 689 rows, and 39 again after scripts/collapse-duplicate-minted-player-rows.mjs retired the 70 it had created. The middle reading is the calibration that matters — the check moved by exactly the number of duplicates introduced and back, so it is measuring the thing it claims to. 16 of the standing 39 have a gsis id on BOTH rows, which is the harder half: those cannot be collapsed by moving identifiers and need a real merge. A finding is a CANDIDATE, not a duplicate — twins exist, and two people sharing a surname, a first initial and a birth date is rare rather than impossible.',
    min_gradeable_units: 1,
    min_denominator: 25000,
    repair_command:
      'Adjudicate each pair before merging; this predicate finds twins as readily as duplicates. Where one row holds no gsis id and is unreferenced, scripts/collapse-duplicate-minted-player-rows.mjs moves the identifiers onto the incumbent and deletes it, proving the row is referenced by none of the 140 pid-carrying tables first. Where BOTH rows carry a gsis id, that script correctly refuses — the two ids are a contradiction it has no standing to resolve, and those belong with the conflated-identity adjudication in scripts/audit-conflated-player-identity.mjs.'
  },

  {
    check_id: 'nickname-legal-name-duplicate-rows',
    invariant:
      'No person holds two `player` rows spelling their first name differently. The sibling duplicate-person-rows check cannot see this class on TWO independent grounds, both verified 2026-08-15 against production: it joins on `formatted_name` equality, which Red/Khalil Murdock and L.T./Labbeus Overton fail by construction, and it requires the second row to hold ZERO external identifiers, while these carry an esb id. It returns none of the five live 2026 pairs. Nothing else grades it either — libs-server/player-name-utils.mjs reaches Jimmy/James and Pat/Patrick but not Red/Khalil, L.T./Labbeus or Trey/James, and `player_aliases` cannot be seeded because the minting source (scripts/import-players-sleeper.mjs, cron 30 3 * * *) carries no legal-name spelling in its payload.',
    grain: ['pid', 'duplicate_pid'],
    rows: async () => {
      // A NON-NAME anchor, which is the whole point: last name, college and
      // draft year read none of the first name, so they join the pairs every
      // name-anchored oracle is structurally blind to. That makes the anchor
      // strong enough to need vetoing rather than trusting -- it also joins
      // brothers and same-class teammates, so each veto below removes a class
      // the bare anchor gets wrong, and what survives is a CANDIDATE for
      // adjudication rather than an automatic merge.
      //
      // Deliberately NOT vetoed: the twin signature (an agreeing birth date
      // with unrelated first names). Measured 2026-08-15, six pairs carry it
      // and the split is roughly even -- Saul, McKenzie and Shoener are genuine
      // brothers, MacKenzie and Walker each carry the SAME draft_overall_pick
      // on both rows (218 and 14), and Brent/Gary Smith carries neither proof.
      // A rule cannot split those, so the three brother pairs are parked in
      // db/checks/parked.json and the rest are reported.

      // Every identifier below is issued per person by its own authority, so
      // two rows holding different values of any one of them are two people
      // whatever else agrees. All are varchar except nfl_player_id.
      const varchar_identifiers = [
        'gsis_player_id',
        'esb_player_id',
        'pfr_player_id',
        'smart_player_id',
        'sleeper_player_id'
      ]
      const person_level_identifiers = [...varchar_identifiers, 'nfl_player_id']

      // A blank string has to be made absent exactly as '0000-00-00' is on the
      // birth date. Left alone it reads as a CONFLICTING value against a real
      // id and vetoes a true duplicate silently -- one row holds a blank
      // pfr_player_id today.
      const identifier_select = [
        ...varchar_identifiers.map(
          (column) => `nullif(trim(${column}), '') as ${column}`
        ),
        'nfl_player_id'
      ].join(', ')

      const identifier_conflict = person_level_identifiers
        .map(
          (column) =>
            `(a.${column} is not null and b.${column} is not null and a.${column} <> b.${column})`
        )
        .join(' or ')

      // The population the check SCANS. A row missing any anchor leg cannot
      // enter a pair, so this -- not `count(*) from player` -- is what
      // min_denominator must read: counting the whole table leaves the floor
      // unable to move when the scan collapses, so wiping `college` would make
      // the check find nothing, emit its clean sentinel, and pass a floor still
      // reading the untouched table.
      const scanned_population = `
        from player
        where last_name is not null and trim(last_name) <> ''
          and college is not null and trim(college) <> ''
          and nfl_draft_year is not null
      `

      const { rows: found } = await db.raw(
        `
        with anchored as (
          select
            pid,
            formatted_name,
            lower(trim(last_name)) as last_name_key,
            lower(trim(college)) as college_key,
            nfl_draft_year,
            -- date_of_birth is a varchar whose absent value is the STRING
            -- '0000-00-00', so absence has to be made explicit before it can
            -- be compared.
            nullif(date_of_birth, '0000-00-00') as date_of_birth,
            ${identifier_select}
          ${scanned_population}
        ),
        anchor_groups as (
          select last_name_key, college_key, nfl_draft_year, count(*) as row_count
          from anchored
          group by 1, 2, 3
        )
        select a.pid, b.pid as duplicate_pid
        from anchored a
        join anchored b
          on a.last_name_key = b.last_name_key
         and a.college_key = b.college_key
         and a.nfl_draft_year = b.nfl_draft_year
         and a.pid < b.pid
        -- Three or more rows on one anchor cannot say WHICH pair is the
        -- duplicate, so the anchor abstains rather than reporting every
        -- combination.
        join anchor_groups g
          on g.last_name_key = a.last_name_key
         and g.college_key = a.college_key
         and g.nfl_draft_year = a.nfl_draft_year
         and g.row_count = 2
        -- Equal names are the sibling check's class, not this one's.
        where a.formatted_name is distinct from b.formatted_name
          and not (${identifier_conflict})
          and not (
            a.date_of_birth is not null
            and b.date_of_birth is not null
            and a.date_of_birth <> b.date_of_birth
          )
        `
      )

      const {
        rows: [scanned]
      } = await db.raw(`select count(*) as count ${scanned_population}`)
      const denominator = Number(scanned.count)

      return found.length
        ? found.map((/** @type {Record<string, any>} */ row) => ({
            pid: row.pid,
            duplicate_pid: row.duplicate_pid,
            numerator: 1,
            denominator
          }))
        : [{ pid: null, duplicate_pid: null, numerator: 0, denominator }]
    },
    max_count: 0,
    calibration:
      'Measured 2026-08-15: 73 pairs against 27,236 rows scanned, out of 27,748 in the table — the 512 difference is rows missing an anchor leg, which cannot enter a pair. 18 of the 73 are from 2024 or later, and 65 carry the 0000-00-00 sentinel on exactly one side, which is the live minting shape; 2 more carry it on both. Every veto is load-bearing and was measured on the bare anchor: 492 two-row anchor keys drop to 380 on the identifier conflict and to 323 on the birth-date conflict, and requiring the two names to DIFFER takes it to 73. The birth-date veto stays reachable on the population it guards, removing 31 of the 104 pairs that survive the identifier veto with differing names — unlike the sentinel-restricted attach rule this class replaced, whose twin veto could never fire. What the check CANNOT grade is an anchor holding three or more rows: 9 such groups covering 27 rows abstain, because the anchor cannot say which pair is the duplicate. Externally verified same-person readings in the differing-name set include Chop/Demeioun Robinson, Kool-Aid/Ga-Quincy McKinstry, Speedy/Devante Noil, Geno/Euguene Hayes, Cobee/Jacobee Bryant, George/Miles Dieffenbach, John/Tyler Varga and Christian/Blake Proehl. The known FALSE joins are Colton/Dylan Taylor (Texas A&M 2021, a quarterback and a receiver, both carrying the sentinel so no veto can see them) and the three brother pairs, all parked. A finding is a CANDIDATE, never an automatic merge: this class was deliberately left as a detector rather than a mint-time guard, because attaching on it would MERGE two people on a wrong match and the write side is where that becomes unrecoverable.',
    min_gradeable_units: 1,
    // One sentinel row when clean, so the row-count floor is a tautology and
    // the denominator carries the whole signal. 27,236 rows measured
    // 2026-08-15 in the scanned population; it only grows with each draft
    // class, so 25,000 leaves about eight percent of headroom against a
    // reading that would mean an anchor leg stopped being populated.
    min_denominator: 25000,
    repair_command:
      'Adjudicate each pair before merging anything. The strongest positive same-person evidence available here is the same draft_overall_pick on both rows — within one anchor group, since the column is NOT unique per year across the table (96 year/pick groups hold more than one row, 40 of them with differing last names). A shared birth date is NOT evidence, because brothers share one. Park a genuine two-person pair in db/checks/parked.json; merge the rest in a dated file under db/adhoc/ following 2026-08-17-merge-nickname-legal-name-player-rows.sql — the first merge of THIS class, which adapts the round-5 structure for pairs where BOTH rows carry identifiers and gamelogs (round-2 gamelog rescue replaces the zero-identifier donor assertion, and the survivor rule carries name-correctness overrides). Note this class is HARDER to merge than the sibling one, and needs a stronger oracle: there the donor is always a shell holding no identifier and no gamelog, so a wrong merge costs little and reverses cleanly, while here BOTH rows routinely carry identifiers and gamelogs and a wrong merge collides them.'
  },

  {
    check_id: 'nfl-plays-games-season-agreement',
    invariant:
      'Every nfl_plays row agrees with the nfl_games row it joins on (season_year, season_type, nfl_week_id). The data-view output aggregator scopes the fact scan ALONE and emits no season predicate on nfl_games (libs-server/data-views/output-aggregator/build-period-cte.mjs), because the duplicate is what flipped the per-period CTE onto a nested loop — so the two agreeing is what makes the dropped predicate implied rather than a widening. Nothing enforces it: nfl_plays carries no foreign key at all and nothing references nfl_games, there is no CHECK, and no importer asserts it. A disagreement therefore changes data-view NUMBERS silently rather than raising, which no gate, no golden and no SQL-validity run can see — they all compare emitted SQL, and the SQL stays correct while the rows behind it stop agreeing.',
    grain: ['esbid'],
    rows: async () => {
      // Aggregated to (esbid, scope tuple) before the join rather than compared
      // per play: the whole point is one finding per GAME, and a game whose week
      // moved would otherwise report every one of its ~180 plays. The play count
      // rides along so a finding says how much data the disagreement covers.
      //
      // nfl_week_id is GENERATED from (season_year, season_type, week) by the
      // same expression on both tables, so comparing it covers `week` too, and
      // it is the exact tuple apply_scope_to_query emits.
      const { rows: found } = await db.raw(
        `
        with play_games as (
          select esbid, season_year, season_type, nfl_week_id, count(*) as play_count
          from nfl_plays
          group by 1, 2, 3, 4
        )
        select p.esbid, p.play_count
        from play_games p
        join nfl_games g on g.esbid = p.esbid
        where p.season_year is distinct from g.season_year
           or p.season_type is distinct from g.season_type
           or p.nfl_week_id is distinct from g.nfl_week_id
        `
      )

      // The population SCANNED is every play, not every disagreeing one: a
      // count-arm denominator that drained as the corpus was repaired would
      // make an emptied nfl_plays and a healthy one read identically.
      const {
        rows: [scanned]
      } = await db.raw('select count(*) as count from nfl_plays')
      const denominator = Number(scanned.count)

      return found.length
        ? found.map((/** @type {Record<string, any>} */ row) => ({
            esbid: row.esbid,
            play_count: Number(row.play_count),
            numerator: 1,
            denominator
          }))
        : [{ esbid: null, numerator: 0, denominator }]
    },
    max_count: 0,
    calibration:
      'EXACT, not a tolerance: a play disagreeing with its own game is a defect by definition, so the healthy reading is zero against a non-zero scanned population and max_count 0 is a live invariant rather than an aspiration. Measured on production 2026-08-21: 0 disagreeing games across 1,487,212 plays and 8,247 distinct (esbid, scope) groups, of which 8,115 matched a game. The scan is a full pass over all 27 nfl_plays partitions and runs in about 1.4 seconds. WHAT IT DELIBERATELY DOES NOT REPORT: the 23,858 plays holding NO nfl_games row at all (2013 PRE and 2014 PRE, 65 games each, plus one 2020 REG and one 2021 REG game). Those are invisible to the emitter either way — the period CTE inner-joins nfl_games, so an orphan play is dropped both before and after the predicate move — and reporting them would put 132 permanently-open findings in front of the one that is real, which is a baseline wearing an adjudication schema. A GROWING orphan population means games are missing and is a different condition with a different owner; this check is silent about it by construction. Also note the two nfl_week_id columns are GENERATED by identical expressions today, so comparing that column covers `week`; if the two expressions ever diverge this check reports it, which is the correct direction.',
    min_gradeable_units: 1,
    // Exactly one sentinel row when clean, so the row-count floor is a tautology
    // and the denominator carries the whole signal. 1,487,212 plays measured
    // 2026-08-21; the table only grows, roughly 60,000 rows a season, and
    // nothing retracts a season. 1,000,000 leaves a third of headroom against
    // the reading this floor exists to catch, which is a partition detached or
    // an nfl_plays emptied to nothing — either of which would otherwise report a
    // clean sentinel and resolve this check's own findings signal.
    min_denominator: 1000000,
    repair_command:
      'Establish which side moved before rewriting either. The play rows carry the scope the importer read from the feed and the game row carries the schedule, so a disagreement is normally a game whose week or season type was corrected on nfl_games without the plays being re-imported: re-import the game with node scripts/import-plays-nflfastr.mjs --year <year>. Do NOT repair by UPDATEing nfl_plays to match nfl_games — season_year is the partition key, so a hand-written update either fails or moves rows between partitions, and it destroys the evidence of which feed was wrong. Until the disagreement is cleared, every data view whose output-aggregator period CTE covers that game reports numbers scoped by the plays side while its nfl_games join contributes the period key from the other.'
  },

  {
    check_id: 'prop-markets-games-season-agreement',
    invariant:
      'Every prop_markets_index row that resolved an esbid carries the season_year of the game it resolved. season_year is functionally determined by esbid — a game belongs to exactly one season — so this is derivable rather than merely expected. Nothing enforces it: the column is nullable, there is no foreign key to nfl_games and no CHECK, and each importer writes the field independently. The consequence of a violation is INVISIBILITY rather than a wrong number, which is why no other oracle sees it: consumers filter markets by season_year (api/routes/markets.mjs, libs-server/data-views-column-definitions/player-betting-market-column-definitions.mjs, libs-server/prop-market-settlement/prop-market-utils.mjs) and several join nfl_games on esbid AND season_year together, so a null silently drops the row from an inner join instead of surfacing as a missing value. Three importers never wrote the column at all — Caesars and BetMGM, fixed 2026-08-23, and BetRivers, dormant since 2024-07-17 and repaired in data but NOT in code — and 210,731 rows sat unreachable through every one of those paths for years while every job reported success.',
    grain: ['esbid', 'source_id'],
    rows: async () => {
      // Aggregated to (esbid, source_id, season_year) before the join rather
      // than compared per market row: the whole point is one finding per game
      // per book, and a book that stopped writing the column would otherwise
      // report every one of that game's markets. The market count rides along so
      // a finding says how much data the disagreement covers.
      //
      // `is distinct from` covers BOTH shapes with one predicate — a season that
      // was never written (null, the defect that motivated this check) and one
      // that disagrees with the game (a mis-attribution). Splitting them would
      // be two rows over one population with one repair.
      const { rows: found } = await db.raw(
        `
        with market_games as (
          select esbid, source_id, season_year, count(*) as market_count
          from prop_markets_index
          where esbid is not null
          group by 1, 2, 3
        )
        select m.esbid, m.source_id::text as source_id, m.market_count
        from market_games m
        join nfl_games g on g.esbid = m.esbid
        where m.season_year is distinct from g.season_year
        `
      )

      // The population SCANNED is every market row this check could grade —
      // rows holding an esbid that resolves to a game — derived from the check's
      // own join rather than from a bare count of the table, which would report
      // the 1.57M esbid-less futures rows this check never looks at and would
      // not move if the graded population collapsed.
      const {
        rows: [scanned]
      } = await db.raw(
        `
        select coalesce(sum(m.market_count), 0) as count
        from (
          select esbid, source_id, season_year, count(*) as market_count
          from prop_markets_index
          where esbid is not null
          group by 1, 2, 3
        ) m
        join nfl_games g on g.esbid = m.esbid
        `
      )
      const denominator = Number(scanned.count)

      return found.length
        ? found.map((/** @type {Record<string, any>} */ row) => ({
            esbid: row.esbid,
            source_id: row.source_id,
            market_count: Number(row.market_count),
            numerator: 1,
            denominator
          }))
        : [{ esbid: null, source_id: null, numerator: 0, denominator }]
    },
    max_count: 0,
    calibration:
      'EXACT, not a tolerance: season_year is derivable from esbid, so a row disagreeing with its own game is a defect by definition and max_count 0 is a live invariant rather than an aspiration. Measured on production 2026-08-23, after the backfill in db/adhoc/2026-08-23-backfill-prop-markets-index-season-year.sql and the two repairs below: 0 disagreeing groups against 1,484,871 graded rows and 3,616 (esbid, source_id, season_year) groups, ALL 3,616 of which match a game. DEMONSTRATED RED rather than assumed: inverting the predicate to `is not distinct from` on the same production corpus reports 3,616 groups, so the join and the comparison are both live and the zero is a finding rather than a query that could never speak. Before the backfill the shipped predicate reported 210,731 rows across BETRIVERS, DRAFTKINGS, CAESARS, FANDUEL and BETMGM, which is the reading that would constitute a real defect. ORPHAN ESBIDS ARE OUTSIDE THIS CHECK BY CONSTRUCTION — it inner-joins nfl_games, so a row whose esbid matches no game is dropped before the comparison — and that population is currently ZERO. It was 6 groups (107 rows, 3 esbids) until db/adhoc/2026-08-23-repoint-orphan-prop-market-esbids.sql repointed them; note the repair had to move season_year in the same statement, because making those rows joinable for the first time would otherwise have handed this check 6 brand-new disagreeing groups. A GROWING orphan population means esbid resolution has broken; nothing currently watches for it, so that is an open gap rather than another owner. It is ALSO silent about the 1,574,411 rows carrying no esbid at all, which have no honest source for a season. Two things live in that population and neither is an agreement question. FanDuel futures rows whose season had been parsed out of a yardage or odds threshold ("1000+ Regular Season Receiving Yards 2024-25" read as season 1000) were repaired in db/adhoc/2026-08-23-repair-fanduel-threshold-season-years.sql, and the parser hole that produced them is closed in libs-server/fanduel/fanduel-market-types.mjs — twice, since the first fix recognised a threshold only by an adjacent "+" and still misread five names spelling it as a decimal, a comparator or a bare unit noun. Separately, 1,817 FanDuel rows carry a NULL season where the parser would now return a year; that is season ABSENT rather than wrong, and it is unrepaired.',
    min_gradeable_units: 1,
    // Exactly one sentinel row when clean, so the row-count floor is a tautology
    // and the denominator carries the whole signal. 1,483,492 graded rows
    // measured 2026-08-23. No code path deletes from prop_markets_index — the
    // importers upsert and nothing prunes — so the population only grows, and
    // 1,000,000 leaves about a third of headroom against the reading this floor
    // exists to catch: an importer stopping, a truncate, or the esbid resolution
    // breaking wholesale, any of which would otherwise report a clean sentinel
    // and resolve this check's own findings signal.
    min_denominator: 1000000,
    repair_command:
      'Establish WHICH SIDE moved before rewriting either, and note the two causes need opposite responses. If the market rows carry a null, an importer is not writing the column and the row is merely incomplete: fix the importer first, because a backfill applied while a writer still emits nulls leaves a tail behind it, then re-derive with an UPDATE joining nfl_games on esbid alone, following db/adhoc/2026-08-23-backfill-prop-markets-index-season-year.sql. Scope any such backfill to rows WITH an esbid — a row without one has no honest source for a season, and observed_at is not a substitute because futures markets are observed year-round and would be assigned a season by the accident of when they were scraped. If instead the market rows carry a season that DISAGREES with the game, do not assume the market side is wrong: nfl_games.season_year moving under a correctly-imported market row produces the identical finding, and rewriting the markets would bury a corrected schedule. Check whether the game row was recently amended before touching anything.'
  },

  {
    check_id: 'prop-market-open-close-esbid-coherence',
    invariant:
      'A prop market’s OPEN and CLOSE index rows name the SAME game. prop_markets_index is keyed by time_type, so one market is two rows, and libs-server/prop-market-settlement/prop-market-utils.mjs treats a disagreement between them as a defect that "grades the selection against another game" — the settlement pass fetches and grades each time_type independently and stamps the result with that row’s own esbid, so a drifted OPEN row settles its selections against a game the market was never about. Nothing watches it. The sibling prop-markets-games-season-agreement check grades each row against the game its OWN esbid resolves to, which both rows pass while naming different games; it names this exact gap in its calibration as unowned. The obvious alternative predicate — whether the selection’s player holds a gamelog in the market’s game — is the WRONG instrument and was measured rather than assumed: of the 18,418 settled selection rows under today’s population, 11,930 have the player holding a gamelog at BOTH esbids, so a presence test scores them clean while the grade may still be against the wrong game. Presence is not correctness; esbid coherence is the property that actually fails.',
    grain: ['source_id', 'source_market_id'],
    rows: async () => {
      // The un-gradeable arm's sentinel. An explicit string rather than a null,
      // so its grain key cannot collide with the CLEAN sentinel a book emits
      // when it has no drift -- the two mean opposite things and would
      // otherwise be indistinguishable in the report.
      const UNGRADEABLE_SENTINEL = '__ungradeable__'

      // ONE aggregate at the market grain, from which BOTH arms are derived:
      // the drifted markets and the population scanned. Sharing the expression
      // is what stops the denominator drifting away from the scan predicate --
      // the failure that had a neighbouring check reporting 27,748 against a
      // 27,236 scan.
      //
      // A market is gradeable only where BOTH time_type rows carry an esbid. A
      // null on either side is a different condition with a different owner
      // (esbid resolution never reached the row), and grading it here would
      // score an unresolved market as coherent.
      //
      // No market-type list appears anywhere in this check, and that is
      // deliberate: it scans every market_type the table holds, so a type
      // remapped in market_type_mappings cannot silently drop out of the
      // population.
      const market_grain = `
        select
          source_id,
          source_market_id,
          count(*) filter (where time_type = 'OPEN' and esbid is not null)
            as open_esbid_rows,
          count(*) filter (where time_type = 'CLOSE' and esbid is not null)
            as close_esbid_rows,
          count(distinct esbid) as distinct_esbids
        from prop_markets_index
        group by 1, 2
      `

      const { rows: per_source } = await db.raw(
        `
        with market_grain as (${market_grain})
        select
          source_id::text as source_id,
          count(*) filter (
            where open_esbid_rows > 0 and close_esbid_rows > 0
          ) as gradeable_markets,
          count(*) filter (
            where not (open_esbid_rows > 0 and close_esbid_rows > 0)
          ) as ungradeable_markets
        from market_grain
        group by 1
        `
      )

      const { rows: drifted } = await db.raw(
        `
        with market_grain as (${market_grain})
        select source_id::text as source_id, source_market_id
        from market_grain
        where open_esbid_rows > 0
          and close_esbid_rows > 0
          and distinct_esbids > 1
        `
      )

      /** @type {Map<string, string[]>} */
      const drifted_by_source = new Map()
      for (const row of drifted) {
        const found = drifted_by_source.get(row.source_id) || []
        found.push(row.source_market_id)
        drifted_by_source.set(row.source_id, found)
      }

      // Two arms PER BOOK rather than one global pair. The denominator floor
      // reads the SMALLEST graded population, and the whole defect population
      // today sits in one book -- so a global denominator would let PrizePicks
      // stop resolving esbids entirely, report a clean sentinel, and hide
      // behind DraftKings' three hundred thousand healthy markets.
      return per_source.flatMap((/** @type {Record<string, any>} */ row) => {
        const source_id = row.source_id
        const gradeable_markets = Number(row.gradeable_markets)
        const ungradeable_markets = Number(row.ungradeable_markets)
        const found = drifted_by_source.get(source_id) || []

        const graded = found.length
          ? found.map((/** @type {string} */ source_market_id) => ({
              source_id,
              source_market_id,
              numerator: 1,
              denominator: gradeable_markets,
              is_gradeable: true
            }))
          : [
              {
                source_id,
                source_market_id: null,
                numerator: 0,
                denominator: gradeable_markets,
                is_gradeable: true
              }
            ]

        return [
          ...graded,
          // Declared, not discovered. A market missing a time_type row or
          // carrying a null esbid on either side leaves the graded population,
          // and without this row it would leave the SCAN as well -- reported
          // nowhere, which is the shape that answers "no problems found" when
          // the honest answer is "I found nothing to check".
          {
            source_id,
            source_market_id: UNGRADEABLE_SENTINEL,
            numerator: ungradeable_markets,
            denominator: gradeable_markets + ungradeable_markets,
            is_gradeable: false
          }
        ]
      })
    },
    precondition: (/** @type {Record<string, any>} */ row) => row.is_gradeable,
    max_count: 0,
    calibration:
      'EXACT, not a tolerance: a market’s two rows either name the same game or they do not, and there is no benign class — so max_count 0 is the only honest threshold and there is nothing here to tune. THIS CHECK IS RED THE DAY IT LANDS, which is a correct reading of a known defect rather than a broken detector, and it is also the demonstration that the predicate can speak. Measured on production 2026-08-30, BEFORE the stamping fix in user:task/league/stabilize-prop-market-esbid-stamping.md had landed: 9,160 drifted markets against 728,739 gradeable markets across eight books, spanning 19,152 selection rows of which 18,418 are settled, over seasons 2023-2025 and 24 market types. ALL 9,160 ARE PRIZEPICKS and the other seven books contribute exactly ZERO — DRAFTKINGS 0 of 362,990, FANDUEL 0 of 98,911, BETRIVERS 0 of 39,284, PINNACLE 0 of 23,932, CAESARS 0 of 15,157, BETMGM 0 of 7,879, FANATICS 0 of 5,990. That one-book concentration is why the denominator is per book: a single global figure would let the only book that has ever failed collapse to nothing and hide behind a healthy sibling. THE DRIFT IS OURS, NOT THE VENDOR’S, and this is the sharpest single reading in the calibration: every one of the 9,160 carries exactly ONE distinct source_event_id across its two rows, so PrizePicks named the same event both times and our esbid resolution disagreed with itself. Zero of them carry two events. NULL source_event_id IS A DIFFERENT CONDITION AND IS DELIBERATELY NOT NAMED IN THE PRECONDITION, having been measured rather than reasoned about: 701 PrizePicks markets (1,340 rows) carry one, and 516 of those are already un-gradeable on the null-esbid arm while the other 185 grade cleanly; ZERO of the 701 are drifted. It is also not a PrizePicks property — BETMGM carries 20,540 such markets and has never drifted — so adding it to the precondition would remove 185 gradeable markets and no findings, narrowing the check for nothing. THE UN-GRADEABLE POPULATION IS LARGE AND EXPECTED: 805,547 markets of 1,534,286 lack an esbid on at least one row, overwhelmingly futures and pre-resolution rows, which is why they are reported as a counted population rather than parked or silently dropped. COST, re-measured 2026-08-30 after the re-finalization loop that had been distorting this host was fixed — the first reading was taken while it was still running and is not reused: 6.0 seconds for the whole check, 2.9s for the per-source arm and 3.2s for the drift arm. THE TWO ARMS DO NOT SHARE A PLAN despite sharing a CTE, which is worth knowing before adding a third: the drift arm runs an incremental sort over an index scan of idx_24959_market at trivial memory, while the per-source arm hash-aggregates a sequential scan and peaks at about 197MB of work memory. That is the number to watch on a shared host, not the seconds. READ A RISE, NOT A FALL. Two live repairs act on this exact class while this check runs — the stamping fix above and the row adjudication in user:task/league/adjudicate-drifted-prop-market-settlements.md — so the count moves for reasons other than new defects, and a falling number is those repairs landing rather than evidence about the detector. A count that rises after the stamping fix deploys is the signal this exists to carry.',
    // Eight rows when fully clean, one per book, so the row-count floor is very
    // nearly a tautology and the denominator carries the signal. 6 sits under
    // today's eight and still catches two books dropping out of the scan
    // entirely.
    min_gradeable_units: 6,
    // REQUIRED here for the reason above: the graded row count is fixed by the
    // number of books when clean and cannot fall with the corpus. Read against
    // the SMALLEST graded population, which is FANATICS at 5,990 markets
    // measured 2026-08-30. Nothing prunes prop_markets_index -- the importers
    // upsert -- so every book's population only grows, and 3,000 leaves half
    // its headroom against the reading this exists to catch: a book whose
    // esbid resolution broke wholesale, which would otherwise emit a clean
    // sentinel over a scan of nothing.
    min_denominator: 3000,
    repair_command:
      'DO NOT REWRITE AN ESBID TO MAKE THE TWO ROWS AGREE. A finding names a market whose two rows disagree; it does not say which row is wrong, and picking the CLOSE row because it is later would settle 9,160 markets against whichever game the last scrape happened to resolve. Establish the correct game from the vendor’s own event first — every drifted market measured so far carries ONE source_event_id across both rows, so the vendor’s event is the oracle and our resolution is the side that moved. The cause is owned upstream by user:task/league/stabilize-prop-market-esbid-stamping.md (scripts/import-prizepicks-odds.mjs and libs-server/insert-prop-markets.mjs), and the standing rows are adjudicated by user:task/league/adjudicate-drifted-prop-market-settlements.md — which also owns re-settling the selections beneath them, since a repointed market leaves prop_market_selections_index still holding a result graded against the old game. Fixing the rows without re-settling swaps a visible finding for an invisible one. A rising count after the stamping fix has deployed is a REGRESSION in the importer and belongs back with that task, not with a data repair.'
  },

  {
    check_id: 'prop-market-selection-grade-consistency',
    invariant:
      'A settled OVER/UNDER selection’s result is the grade its OWN stored numbers produce: selection_result is a total function of metric_result_value against selection_metric_line, with over-the-line WON for OVER and LOST for UNDER, under-the-line the reverse, and equal a PUSH. Both operands sit on the row being graded, so this needs no reference and no join — the check reads one table and asks whether a row agrees with itself. Nothing enforces it. libs-server/prop-market-settlement/selection-result-writer.mjs writes both columns in one UPDATE today, but they are two independent CASE expressions over an updates array rather than one derivation, so a row can carry a metric from one game and a result from another and no constraint objects. Before 15c18bae8 the two columns were written by SEPARATE statements against DIFFERENT tables at DIFFERENT grains — selection_result at selection grain on prop_market_selections_index, metric_result_value at market grain on prop_markets_index, and the latter only where the metric was non-null — which is the concrete path by which a row acquires divergent provenance. THE SIBLING CHECK CANNOT SEE THIS. prop-market-open-close-esbid-coherence grades whether a market’s two rows name the same game and never reads a result value at all; a market can be perfectly coherent on esbid and still carry a selection graded against the wrong line, and it can be drifted while every selection beneath it agrees with itself. This is also the only oracle in the registry that reads settlement OUTPUT rather than its inputs, so a settlement defect that writes a wrong answer into a well-formed row is invisible everywhere else.',
    grain: [
      'source_id',
      'source_market_id',
      'source_selection_id',
      'time_type'
    ],
    rows: async () => {
      // The un-gradeable arm's sentinel, and the clean arm's. Explicit strings
      // rather than nulls so the two cannot collide in the report -- a book
      // with nothing to grade and a book with nothing wrong mean opposite
      // things.
      const UNGRADEABLE_SENTINEL = '__ungradeable__'
      const CLEAN_SENTINEL = '__clean__'

      // ONE scan predicate and ONE grade expression, shared by the violation
      // arm and the denominator arm. Sharing them is what stops the
      // denominator drifting away from the population actually scanned -- the
      // failure a neighbouring check hit by borrowing a sibling's count.
      //
      // Scoped to OVER/UNDER deliberately. The other settled selection types
      // (YES/NO and the touchdown-scorer family, 160,420 rows) grade by a
      // different rule that these two operands do not express, so folding them
      // in would swamp the un-gradeable arm with an expected class rather than
      // report anything.
      const graded_scope = `
        selection_result is not null
        and selection_type in ('OVER', 'UNDER')
      `
      const has_operands = `
        metric_result_value is not null
        and selection_metric_line is not null
      `
      const expected_grade = `
        case
          when metric_result_value > selection_metric_line
            then case when selection_type = 'OVER' then 'WON' else 'LOST' end
          when metric_result_value < selection_metric_line
            then case when selection_type = 'OVER' then 'LOST' else 'WON' end
          else 'PUSH'
        end
      `

      const { rows: per_source } = await db.raw(
        `
        select
          source_id::text as source_id,
          count(*) filter (where ${has_operands}) as gradeable_rows,
          count(*) filter (where not (${has_operands})) as ungradeable_rows
        from prop_market_selections_index
        where ${graded_scope}
        group by 1
        `
      )

      const { rows: disagreeing } = await db.raw(
        `
        select
          source_id::text as source_id,
          source_market_id::text as source_market_id,
          source_selection_id::text as source_selection_id,
          time_type::text as time_type
        from prop_market_selections_index
        where ${graded_scope}
          and ${has_operands}
          and selection_result::text is distinct from (${expected_grade})
        `
      )

      /** @type {Map<string, Record<string, any>[]>} */
      const disagreeing_by_source = new Map()
      for (const row of disagreeing) {
        const found = disagreeing_by_source.get(row.source_id) || []
        found.push(row)
        disagreeing_by_source.set(row.source_id, found)
      }

      // Two arms PER BOOK rather than one global pair. The defect lives in
      // shared settlement code rather than in one vendor's importer, so the
      // split is not about where the bug is -- it is the only thing that makes
      // a COLLAPSE legible. A book that stops settling entirely drops out of
      // the graded set and takes min_gradeable_units below its floor; under a
      // single global denominator it would vanish silently behind DraftKings'
      // million healthy rows.
      return per_source.flatMap((/** @type {Record<string, any>} */ row) => {
        const source_id = row.source_id
        const gradeable_rows = Number(row.gradeable_rows)
        const ungradeable_rows = Number(row.ungradeable_rows)
        const found = disagreeing_by_source.get(source_id) || []

        // A book with nothing to grade is UN-GRADEABLE, never clean: it
        // scanned no population, so there is nothing for a zero to be a
        // finding about.
        const graded = !gradeable_rows
          ? []
          : found.length
            ? found.map((/** @type {Record<string, any>} */ found_row) => ({
                source_id,
                source_market_id: found_row.source_market_id,
                source_selection_id: found_row.source_selection_id,
                time_type: found_row.time_type,
                numerator: 1,
                denominator: gradeable_rows,
                is_gradeable: true
              }))
            : [
                {
                  source_id,
                  source_market_id: CLEAN_SENTINEL,
                  source_selection_id: CLEAN_SENTINEL,
                  time_type: CLEAN_SENTINEL,
                  numerator: 0,
                  denominator: gradeable_rows,
                  is_gradeable: true
                }
              ]

        return [
          ...graded,
          // Declared, not discovered. A settled OVER/UNDER row missing either
          // operand cannot be graded against itself, and without this arm it
          // would leave the SCAN as well -- a settlement path writing results
          // with no metric would shrink the population and report cleaner.
          {
            source_id,
            source_market_id: UNGRADEABLE_SENTINEL,
            source_selection_id: UNGRADEABLE_SENTINEL,
            time_type: UNGRADEABLE_SENTINEL,
            numerator: ungradeable_rows,
            denominator: gradeable_rows + ungradeable_rows,
            is_gradeable: false
          }
        ]
      })
    },
    precondition: (/** @type {Record<string, any>} */ row) => row.is_gradeable,
    max_count: 0,
    calibration:
      'EXACT, not a tolerance: the grade is a total function of two columns on the row itself, so a disagreement is a defect by definition and there is nothing here to tune. THIS CHECK IS RED THE DAY IT LANDS with 6 findings, which is a correct reading of a real defect rather than a broken detector. Measured on production 2026-08-30 at selection grain, by running the SHIPPED queries rather than a paraphrase of them: 1,647,010 gradeable rows across six books, of which exactly 6 disagree — 3 carrying WON where the numbers give LOST and 3 the reverse. ALL 6 ARE time_type CLOSE, across three markets, two sides each: FANDUEL market 734.77171513 (Amon-Ra St. Brown, line 162.5, metric 156.0, OVER recorded WON), PRIZEPICKS 1807454 (Keenan Allen, 64.5, 68.0, OVER recorded LOST) and PRIZEPICKS 3313862 (George Kittle, 51.5, 57.0, OVER recorded LOST). THE PUSH BOUNDARY IS CLEAN AND WAS MEASURED RATHER THAN ASSUMED: all 2,204 rows where metric equals line carry PUSH and none carry anything else, so the third branch is live and costs no findings. DEMONSTRATED RED rather than inferred: the shipped predicate reports 6, and inverting it to `is not distinct from` over the same corpus reports 1,647,004 — the two summing to the 1,647,010 scanned — so both the comparison and the enum cast are speaking and the 6 is a finding rather than a query that cannot match. TWO BOOKS ARE UN-GRADEABLE BY POPULATION, not by defect — BETRIVERS and BETMGM each hold ZERO settled OVER/UNDER rows, so they emit no graded arm at all; that is why the row-count floor sits at 6 rather than 8. THE 6 SPAN TWO BOOKS AND TWO DISTINCT CAUSES, which is the reading that matters for anyone acting on a finding. The FanDuel pair is a LINE MIS-PAIRING with no esbid involvement: that market carries two lines, 88.5 and 162.5, the metric 156.0 is correct and the player was active, and the 88.5 grade was written onto the 162.5 selections. The four PrizePicks rows are the ESBID DRIFT surfacing in settlement output: each market names one game on its OPEN row and another on its CLOSE row, the metric was derived from the drifted esbid while the result was graded against the other game, and both players were inactive with 0 receiving yards in the game their market actually belongs to. UN-GRADEABLE IS SMALL AND WORTH WATCHING: 215 settled OVER/UNDER rows lack a metric or a line (DRAFTKINGS 163, PRIZEPICKS 48, FANDUEL 4), and a RISE there means settlement has begun writing results it cannot substantiate, which this check would otherwise read as a shrinking population and report cleaner. SCOPE IS OVER/UNDER ONLY: 160,420 settled rows of other selection types grade by a rule these two operands do not express and are outside the invariant by construction, not by omission.',
    // Six rows when fully clean, one per book that settles anything, so the
    // row-count floor is nearly a tautology and the denominator carries the
    // signal. 6 is today's exact count, which makes this floor the real
    // collapse detector: a book that stops settling entirely becomes
    // un-gradeable, drops out of the graded set, and fires it.
    min_gradeable_units: 6,
    // REQUIRED here for the reason above: the graded row count is fixed by the
    // number of settling books when clean and cannot fall with the corpus.
    // Read against the SMALLEST graded population, which is FANATICS at 220
    // settled rows measured 2026-08-30 -- genuinely small because that book
    // settles little, not because anything collapsed. The floor is therefore
    // deliberately low and catches a book shrinking drastically without
    // vanishing; a book vanishing outright is caught by the row floor above,
    // which is the stronger of the two instruments here.
    min_denominator: 100,
    repair_command:
      'A FINDING NAMES A ROW THAT CONTRADICTS ITSELF; IT DOES NOT SAY WHICH COLUMN MOVED. Do not rewrite selection_result to match the metric — that is the obvious repair and it was wrong for every row measured so far. Establish which side is wrong first, and expect at least two causes. Where the market’s OPEN and CLOSE rows name different games (the sibling prop-market-open-close-esbid-coherence check), the METRIC is the moved side: it was derived from the drifted esbid while the result was graded against the other game, so the repair is to correct the esbid and force a re-settle, never to flip the result. Note that prop_market_selections_index carries NO esbid, so repointing the market alone changes nothing beneath it — the esbid fix and the re-settle (missing_only false) ship together or the finding merely goes invisible. Where the market is esbid-coherent, look instead for two lines under one market: the measured FanDuel case had one line’s grade written onto the other line’s selections, which is a settlement-writer defect and needs a code fix rather than a data repair. The upstream causes are owned by user:task/league/stabilize-prop-market-esbid-stamping.md and user:task/league/adjudicate-drifted-prop-market-settlements.md.'
  },

  {
    check_id: 'snaps-games-season-agreement',
    invariant:
      'Every nfl_snaps row carries the season_year of the game its esbid resolves to. season_year is functionally determined by esbid — a game belongs to exactly one season — so this is derivable rather than merely expected, and nothing enforces it: no foreign key, no CHECK, and the column is part of the primary key rather than a computed one. The writer NEVER READS nfl_games: private/libs-server/ngs.mjs takes the season straight off the vendor payload (`data.plays.find((play) => play.season)?.season`) and keys its delete-and-reinsert on esbid alone, so the two sides are stamped from independent sources and can only be compared after the fact. Two aggravating properties make a failure here silent rather than loud. The optional chain yields `undefined` when no play in the feed carries a season, against a NOT NULL column; and the whole snap write sits inside a try/catch that logs to a debug namespace and continues, so a rejected batch leaves the run green. A disagreement therefore drops the rows from every consumer that scopes snaps by season while the job reports success.',
    grain: ['esbid'],
    rows: async () => {
      // Aggregated to (esbid, season_year) before the join rather than compared
      // per snap: the whole point is one finding per GAME, and a game whose
      // season moved would otherwise report every one of its ~3,500 snap rows.
      // The snap count rides along so a finding says how much data the
      // disagreement covers.
      const { rows: found } = await db.raw(
        `
        with snap_games as (
          select esbid, season_year, count(*) as row_count
          from nfl_snaps
          group by 1, 2
        )
        select m.esbid, m.row_count
        from snap_games m
        join nfl_games g on g.esbid = m.esbid
        where m.season_year is distinct from g.season_year
        `
      )

      // The population SCANNED is every snap row this check could grade — rows
      // whose esbid resolves to a game — derived from the check's OWN join
      // rather than from a bare count of the table. A bare count would keep
      // reading the full table if the join collapsed, which is the exact shape
      // that let a neighbouring check report 27,748 against a 27,236 scan.
      const {
        rows: [scanned]
      } = await db.raw(
        `
        select coalesce(sum(m.row_count), 0) as count
        from (
          select esbid, season_year, count(*) as row_count
          from nfl_snaps
          group by 1, 2
        ) m
        join nfl_games g on g.esbid = m.esbid
        `
      )
      const denominator = Number(scanned.count)

      return found.length
        ? found.map((/** @type {Record<string, any>} */ row) => ({
            esbid: row.esbid,
            row_count: Number(row.row_count),
            numerator: 1,
            denominator
          }))
        : [{ esbid: null, numerator: 0, denominator }]
    },
    max_count: 0,
    calibration:
      'EXACT, not a tolerance: season_year is derivable from esbid, so a row disagreeing with its own game is a defect by definition and max_count 0 is a live invariant rather than an aspiration. Measured on production 2026-08-23: 0 disagreeing groups against 11,634,932 graded rows across 3,269 (esbid, season_year) groups, every one of which matched a game — there are ZERO orphan esbids in this table, unlike the sibling gamelogs check. DEMONSTRATED RED rather than assumed: inverting the shipped predicate to `is not distinct from` on the same production corpus reports all 3,269 groups covering all 11,634,932 rows, so the join and the comparison are both live and the zero is a finding rather than a query that could never speak. COST, measured with explain analyze the same day: 742ms, a parallel append over all 27 nfl_snaps partitions feeding a hash join against an index-only scan of nfl_games — cheap enough for the weekly runner at this table’s size. WHAT MAKES A DEFECT REACHABLE HERE, since the writer never mis-stamps under normal operation: nfl_games upserts on esbid and merges every column including season_year (scripts/import-nfl-games-nfl.mjs), so a schedule correction rewrites the game while the snap rows keep the season the NGS feed reported when they were first imported. That is the same cause the nfl-plays-games-season-agreement repair command describes, and nothing re-stamps snaps when it happens. A SHARPER VARIANT WAS TESTED AND DELIBERATELY NOT REGISTERED: season_year sits inside this table’s onConflict key (esbid, play_id, gsis_it_player_id, season_year), so a drifted season would mint a duplicate row rather than update one — measured 2026-08-23, zero (esbid, play_id, gsis_it_player_id) triples carry more than one distinct season_year. That is a corroborator of this same invariant, not a second condition, and registering it would leave one invariant with two graders that can drift apart and disagree about method.',
    min_gradeable_units: 1,
    // Exactly one sentinel row when clean, so the row-count floor is a
    // tautology and the denominator carries the whole signal. 11,634,932
    // graded rows measured 2026-08-23, partitioned by season and growing
    // roughly 450,000 rows a year; nothing prunes and no code path deletes
    // except the per-esbid rebuild, which reinserts. 8,000,000 leaves about a
    // third of headroom against the reading this floor exists to catch — a
    // partition detached or the esbid join breaking wholesale, either of which
    // would otherwise report a clean sentinel and resolve this check’s own
    // findings signal.
    min_denominator: 8000000,
    repair_command:
      'Establish WHICH SIDE moved before rewriting either. The snap rows carry the season the NGS feed reported at import and the game row carries the schedule, so a disagreement is normally a game whose season was corrected on nfl_games without the snaps being re-imported — nfl_games upserts on esbid and merges season_year, so this happens with no snap write at all. Re-import the affected game rather than UPDATEing nfl_snaps: season_year is the partition key, so a hand-written update either fails or moves rows between partitions, and it destroys the evidence of which feed was wrong. Check first whether the game row was recently amended; if instead the FEED is wrong, the season is read at private/libs-server/ngs.mjs from the first play carrying a `season` field, and note that path swallows a failed snap insert into a debug log rather than failing its run.'
  },

  {
    check_id: 'gamelogs-games-season-agreement',
    invariant:
      'Every player_gamelogs row carries the season_year of the game its esbid resolves to. season_year is functionally determined by esbid, so this is derivable rather than merely expected, and nothing enforces it — no foreign key to nfl_games, no CHECK. The writer stamps the season from its own INVOCATION rather than from the game: scripts/generate-player-gamelogs.mjs selects games where nfl_games.season_year equals the --season_year argument and then writes that argument onto every row, so the two agree when the row is written and never again. No other oracle sees a disagreement. scripts/audit-player-gamelogs.mjs grades stat VALUES against Pro Football Reference — the pfr-gamelog-agreement class already in this registry — and is silent about which season a row claims; gamelog-orphans grades the child-to-parent edge and never reaches nfl_games. A wrong season is fully populated and entirely wrong, so every null-counting check scores it healthy while the row drops out of any consumer that scopes gamelogs by season.',
    grain: ['esbid'],
    rows: async () => {
      // Aggregated to (esbid, season_year) before the join rather than compared
      // per gamelog: one finding per GAME, not one per player in it.
      const { rows: found } = await db.raw(
        `
        with gamelog_games as (
          select esbid, season_year, count(*) as row_count
          from player_gamelogs
          group by 1, 2
        )
        select m.esbid, m.row_count
        from gamelog_games m
        join nfl_games g on g.esbid = m.esbid
        where m.season_year is distinct from g.season_year
        `
      )

      // Derived from the check's OWN scan predicate. A bare count of
      // player_gamelogs would report the 2,310 rows holding an esbid that
      // matches no game, which this check never looks at, and would not move if
      // the graded population collapsed.
      const {
        rows: [scanned]
      } = await db.raw(
        `
        select coalesce(sum(m.row_count), 0) as count
        from (
          select esbid, season_year, count(*) as row_count
          from player_gamelogs
          group by 1, 2
        ) m
        join nfl_games g on g.esbid = m.esbid
        `
      )
      const denominator = Number(scanned.count)

      return found.length
        ? found.map((/** @type {Record<string, any>} */ row) => ({
            esbid: row.esbid,
            row_count: Number(row.row_count),
            numerator: 1,
            denominator
          }))
        : [{ esbid: null, numerator: 0, denominator }]
    },
    max_count: 0,
    calibration:
      'EXACT, not a tolerance: season_year is derivable from esbid, so a row disagreeing with its own game is a defect by definition and max_count 0 is a live invariant rather than an aspiration. Measured on production 2026-08-23: 0 disagreeing groups against 885,864 graded rows across 8,134 (esbid, season_year) groups. DEMONSTRATED RED rather than assumed: inverting the shipped predicate to `is not distinct from` on the same production corpus reports all 8,134 groups covering all 885,864 rows, so the join and the comparison are both live and the zero is a finding rather than a query that could never speak. WHAT MAKES A DEFECT REACHABLE, since writer and game agree at write time by construction: nfl_games upserts on esbid and merges every column including season_year and week (scripts/import-nfl-games-nfl.mjs), so a corrected schedule rewrites the game while the gamelog rows keep the season the generator was invoked with. Nothing re-stamps them. This is a NARROWER window than the sibling snaps check, whose writer takes its season from the vendor payload and never consults nfl_games at all — the two are registered separately because their repair paths name different importers, following the same one-row-per-table shape as nfl-plays-games-season-agreement and prop-markets-games-season-agreement. WHAT IT DELIBERATELY DOES NOT REPORT: the 2,310 rows across 124 esbids holding no nfl_games row at all, all of them 2013 (1,040 rows, 59 games) and 2014 (1,270 rows, 65 games) — the same missing PRE-season games nfl-plays-games-season-agreement names in its own calibration, which is corroboration that the gap is one population and not two. Reporting them here would put 124 permanently-open findings in front of the one that is real, which is a baseline wearing an adjudication schema; a GROWING orphan population means games are missing and is a different condition with a different owner. A SHARPER VARIANT WAS TESTED AND DELIBERATELY NOT REGISTERED: season_year sits inside this table’s onConflict key (esbid, pid, season_year), and unlike the snaps writer there is no delete-then-insert, so a drifted season would mint a DUPLICATE gamelog rather than update one — measured 2026-08-23, zero (esbid, pid) pairs carry more than one distinct season_year. It corroborates this same invariant rather than adding a condition, and registering it would leave one invariant with two graders.',
    min_gradeable_units: 1,
    // Exactly one sentinel row when clean, so the row-count floor is a
    // tautology and the denominator carries the whole signal. 885,864 graded
    // rows measured 2026-08-23, growing roughly 30,000 a season and never
    // pruned. 600,000 leaves about a third of headroom against the reading this
    // floor exists to catch, which is the esbid join breaking or the table
    // being emptied — either of which would otherwise report a clean sentinel
    // and resolve this check’s own findings signal.
    min_denominator: 600000,
    repair_command:
      'Establish WHICH SIDE moved before rewriting either, and do NOT assume the gamelog side is wrong. nfl_games upserts on esbid and merges season_year, so a game whose season or week was corrected under a correctly-generated gamelog produces this finding, and rewriting the gamelogs would bury the corrected schedule — check whether the game row was recently amended first. If the game is right and the gamelogs are stale, regenerate the affected week rather than hand-updating: node scripts/generate-player-gamelogs.mjs --season_year <year> --week <week>. Note that season_year is part of this table’s conflict key and the writer does not delete first, so a regeneration under a CHANGED season inserts a second row instead of updating the old one; confirm the stale row is gone afterwards rather than assuming the upsert replaced it.'
  },

  {
    check_id: 'player-field-override-drift',
    invariant:
      'Every human verdict in player_field_override equals the value `player` actually holds for that (pid, column_name). This is the only oracle that can see a correction which was RECORDED and never LANDED: two writes on the parent repair task were claimed applied and "verified by read-back" while JORD-MURR-006621 still held 8106 and SEAN-RYAN-027249 still held 5834, and nothing could detect it because the intended values existed only as prose. player_changelog structurally cannot cover this — a write that never happened leaves no changelog row at all.',
    grain: ['pid', 'column_name'],
    rows: async () => {
      // The compared column is DATA, not a literal, so the live value is read
      // through to_jsonb rather than named in the select list. `->>` yields the
      // text form of whatever type the column is, which is the spelling the
      // override stores.
      //
      // LEFT JOIN, not JOIN: an override whose player row was merged away is a
      // verdict that can no longer be honored, and an inner join would make it
      // silently leave the population rather than report it.
      const { rows: found } = await db.raw(
        `
        select
          o.pid,
          o.column_name,
          o.override_value,
          to_jsonb(p) ->> o.column_name as live_value,
          (p.pid is null) as is_player_row_missing
        from player_field_override o
        left join player p on p.pid = o.pid
        `
      )

      // Every override is scanned, so the whole table is the denominator. There
      // is no acceptable fraction of ignored human verdicts, which is why this
      // is a count over the declared population rather than a rate over a
      // larger one.
      const denominator = found.length

      const violations = found.filter(
        (/** @type {Record<string, any>} */ row) => {
          if (row.is_player_row_missing) return true
          const { override_value, live_value } = row
          if (override_value == null && live_value == null) return false
          if (override_value == null || live_value == null) return true
          return String(override_value) !== String(live_value)
        }
      )

      return violations.length
        ? violations.map((/** @type {Record<string, any>} */ row) => ({
            pid: row.pid,
            column_name: row.column_name,
            numerator: 1,
            denominator
          }))
        : [{ pid: null, column_name: null, numerator: 0, denominator }]
    },
    max_count: 0,
    calibration:
      'EXACT, not a tolerance: an override disagreeing with `player` is a defect by definition, so the healthy reading is zero violations against a non-zero scanned population and max_count 0 is a live invariant rather than an aspiration. Measured 2026-08-17 at seeding: 14 overrides, 0 violations — the 8 date_of_birth backfills and 6 sleeper_player_id links that were applied to `player` with no provenance at all, retro-declared so their evidence attaches to values already in the table. This catches THREE distinct causes with one predicate, which is why it earns its own row: an override recorded but never applied (the failure that motivated it), an importer forcing the field back afterwards, and a hand-written UPDATE outside updatePlayer. It does not care which happened and cannot be fooled by the write path, unlike any contract inside updatePlayer itself. THIS IS A CHECK AND NOT A GATE, deliberately: override-versus-player drift arises with no code change at all, and db/README.md is explicit that a standing data condition in db/gates/ defers every session push to mistakia/league. WHAT IT CANNOT SEE: a field nobody has adjudicated. It grades declared verdicts only, so it is silent about a wrong value carrying no override — that is the resolver and the importers` business, not this. The population only grows, since a verdict is revised in place rather than deleted.',
    min_gradeable_units: 1,
    // Exactly one sentinel row when clean, so the row-count floor is a
    // tautology and the denominator carries the whole signal. 14 overrides at
    // seeding, growing as the parent repair task declares the rest of its
    // adjudicated writes. 10 sits under today's figure and catches the reading
    // that matters here — an emptied override table would otherwise report a
    // clean sentinel and pass, which is exactly the vacuous green this floor
    // exists to deny.
    min_denominator: 10,
    repair_command:
      'Do NOT edit player_field_override to match `player` — that inverts the direction of authority and destroys the verdict. Establish which side is wrong first. If the override is right and the write never landed or was reverted, re-apply it: node libs-server/set-player-field-override.mjs --pid <pid> --column_name <column> --override_value <value> --provider_name <provider> --adjudicated_by <who> --evidence_source <evidence> --reason <why>. The usual cause of a refusal is the cross-row uniqueness guard on an external id, which requires clearing the value from the row wrongly holding it FIRST. If the verdict itself has been superseded by new evidence, re-run that same command with the new value and evidence, which revises the row in place and records the change in player_changelog. If the player row was merged away, re-point the override at the surviving pid.'
  },

  {
    check_id: 'adp-source-season-coverage',
    invariant:
      'Every ADP source we run an importer for wrote rows, in every format it publishes, for every season whose draft window has opened. No other oracle sees a season-shaped hole: the per-run grade in libs-server/grade-adp-import-run.mjs only speaks for a run that HAPPENED, and the runs staleness sweep only speaks for a source whose cadence is declared — so a commented-out crontab line produces no failing run, no stale ledger row and no finding anywhere. That is exactly how the whole 2025 season ended up holding Sleeper ADP and nothing else, discovered a year later by a data view rendering blank.',
    grain: ['season_year', 'source_id'],
    rows: async () => {
      const seasons = await db('player_adp_index')
        .select('season_year')
        .count('* as season_rows')
        .groupBy('season_year')

      // Denominator is the season's WHOLE adp population across every source,
      // not this source's own row count -- which is zero in precisely the case
      // this check exists to catch, and a zero denominator is un-gradeable
      // rather than clean. A season with no adp rows at all is a different and
      // larger failure, and correctly reads un-gradeable here.
      const season_rows_by_year = new Map(
        seasons.map((/** @type {Record<string, any>} */ row) => [
          Number(row.season_year),
          Number(row.season_rows)
        ])
      )

      const observed = await db('player_adp_index')
        .select('season_year', 'source_id')
        .countDistinct('average_draft_position_format_id as formats')
        .groupBy('season_year', 'source_id')

      const formats_by_key = new Map(
        observed.map((/** @type {Record<string, any>} */ row) => [
          `${row.season_year}:${row.source_id}`,
          Number(row.formats)
        ])
      )

      const rows = []
      for (const [season_year, season_rows] of season_rows_by_year) {
        for (const source of EXPECTED_ADP_SOURCES) {
          if (season_year < source.first_season) continue
          if (source.last_season && season_year > source.last_season) continue

          const formats_found =
            formats_by_key.get(`${season_year}:${source.source_id}`) || 0
          const formats_missing = Math.max(
            source.expected_formats - formats_found,
            0
          )

          rows.push({
            season_year,
            source_id: source.source_id,
            numerator: formats_missing,
            denominator: season_rows,
            formats_found,
            formats_expected: source.expected_formats,
            // The season is judged only once its draft window has opened. Every
            // source publishes by late July, and the importers' own crontab
            // window is June through August, so August 1 is past the point
            // where an absence is early rather than missing. Before that date
            // the current season is legitimately empty and grading it would
            // manufacture a finding every winter.
            window_open: adp_season_window_is_open(season_year)
          })
        }
      }

      return rows
    },
    precondition: (/** @type {Record<string, any>} */ row) => row.window_open,
    max_count: 0,
    calibration:
      'EXACT, not a tolerance: a source we schedule an importer for either wrote its formats for a season or it did not, so the healthy reading is zero missing formats against a non-zero season population. Measured 2026-08-23 across the three seasons player_adp_index holds. 2024: all seven then-live sources present at their full format counts (SLEEPER 12, RTS 3, CBS 2, MFL 2, ESPN 1, YAHOO 1, NFL 1) against 17,242 season rows. 2026: the seven live sources plus UNDERDOG present at full counts against 14,089 rows and climbing. 2025 is the defect this is calibrated against — 17,498 season rows, ALL of them SLEEPER, every other source at zero because commit 242976665 re-enabled the secondary ADP crontab lines only in 2026 after they had been disabled for the 2025 season. Those six (season, source) pairs are parked as baselined debt rather than adjudicated, because the data is genuinely missing rather than correct. Two of the six are repairable and four are not, and the distinction was measured on 2026-08-23 rather than assumed: MFL serves full historical ADP under PERIOD=ALL (2022 returns 3,068 drafts where the importer live PERIOD=RECENT returns zero out of season) and ESPN serves it per season back to 2020 (2019 returns 0.0 for every player), while CBS, RTS and Yahoo are scrapes of a live draft board and NFL.com has shut down. The expectation table is DECLARED rather than derived from what the table happens to hold, because deriving it would define the healthy state as whatever landed and could never report an absence. Format counts are minimums, so a vendor adding a format is not a finding while dropping one is.',
    min_gradeable_units: 6,
    // The row count grows one season at a time, so a floor on it alone would be
    // satisfied by a scan that read almost nothing. 1,000 sits an order of
    // magnitude under the smallest season population observed (17,242 in 2024)
    // and far above the reading it exists to catch, which is the group-by
    // breaking and returning a near-empty season.
    min_denominator: 1000,
    repair_command:
      'Identify which of the three layers failed before touching data. If the importer never ran, check server/crontab-main/league-imports.cron for the source line and the runs ledger (`base run list --source service:league-import-<source>-adp`). If it ran and wrote nothing, its own oracle should have failed the run — read /var/log/league/import-<source>-adp.log for the `oracle FAIL` line. Whether a past season can be backfilled is PER VENDOR and must not be assumed either way: MFL serves it under PERIOD=ALL and ESPN under its per-season kona endpoint (2020 onward), while CBS, RTS and Yahoo scrape a live draft board that no longer exists for a closed season. Park a genuinely unreachable season as baselined debt rather than leaving the finding open.'
  },

  {
    check_id: 'nfl-plays-game-coverage',
    invariant:
      'Every game nfl_games calls FINAL holds at least one nfl_plays row. Nothing else sees a game whose plays never landed: the play importers report per-run success, the season-agreement check compares plays that EXIST against their game, and every downstream aggregate inner-joins nfl_plays — so a missing game leaves no failed row and simply contributes nothing, which reads identically to a game nobody played.',
    grain: ['season_year', 'season_type', 'week'],
    rows: async () => {
      // Grained by week rather than by game so one finding names a whole
      // failed import run, which is how this defect actually arrives -- a week
      // at a time, when the nightly job processed a different season_type.
      const { rows } = await db.raw(
        `
        select
          g.season_year,
          g.season_type,
          g.week,
          count(*) as denominator,
          count(*) filter (
            where exists (select 1 from nfl_plays p where p.esbid = g.esbid)
          ) as numerator
        from nfl_games g
        where g.season_year >= 2015
          and g.week is not null
          and g.status like 'FINAL%'
        group by 1, 2, 3
        `
      )

      return rows.map((/** @type {Record<string, any>} */ row) => ({
        season_year: row.season_year,
        season_type: row.season_type,
        week: row.week,
        numerator: Number(row.numerator),
        denominator: Number(row.denominator)
      }))
    },
    // A week holding fewer than 8 final games is mid-week or a scheduling
    // artifact, not a gradeable population. Declared rather than filtered out
    // of `rows` so a week that COLLAPSED to three games is reported
    // un-gradeable instead of vanishing from the scan entirely.
    precondition: (/** @type {Record<string, any>} */ row) =>
      row.denominator >= 8,
    min_rate: 1.0,
    calibration:
      'EXACT, not a tolerance: a FINAL game either has plays or it does not, so the healthy reading is 1.0 and min_rate 1.0 is a live invariant. Measured 2026-08-26 across the full 2001-onward corpus of 498 gradeable weeks, of which this check grades the 229 from 2015: median 1.0000, fifth percentile 1.0000, and only SIX weeks short of full coverage in the entire corpus. Four of the six are 2014 PRE weeks 1-4, all at 0.0000 — the same era gap the nfl-plays-games-season-agreement calibration already names for 2013 and 2014 preseason, where the feed predates our coverage. THAT is why this check floors at season_year 2015 rather than parking four permanent findings: an era with no data at all is a different condition with a different owner, and putting four un-closeable rows in front of the live one is how a detector stops being read. The remaining two are the defects this was written for: 2025 PRE week 3 at 0.0625, one game of sixteen, since repaired, and 2021 PRE week 3 at 0.9375, fifteen of sixteen, now PARKED as adjudicated — NFL Pro returns no plays at all for 2021082855 (measured 2026-08-26 on a live premium token), so there is nothing to import and the row cannot be closed by a re-import. Both are preseason, which is the season_type every scheduled path treats as optional. The 2015 floor and the eight-game precondition together leave 229 gradeable weeks of the 286 in range.',
    min_gradeable_units: 180,
    repair_command:
      'Re-import the week: node scripts/import-plays-nfl-v1.mjs --year <year> --week <week> --season_type <type>. Confirm the games are genuinely absent rather than carrying a different esbid before importing — a game whose esbid moved is a repoint, not a re-import, and importing over it doubles the plays.'
  },

  {
    check_id: 'nfl-snaps-game-coverage',
    invariant:
      'Every game nfl_games calls FINAL holds at least one nfl_snaps row. The snap rows are written as a SIDE EFFECT of private/scripts/import-plays-nfl-pro.mjs (through ngs.save_play_data), inside a try/catch that logs to a debug namespace and continues, so a failed snap write leaves that run green. Nothing downstream can see the absence either: gamelog-snaps-unaggregated derives its denominator FROM nfl_snaps, so a game with no snap rows contributes no gradeable population and vanishes from that scan rather than failing it. This is the declared-scope companion to that check, and without it the two together would report a clean sweep over a week whose snaps never landed.',
    grain: ['season_year', 'season_type', 'week'],
    rows: async () => {
      // The distinct-esbid CTE is load-bearing, not a stylistic choice. The
      // obvious `exists (select 1 from nfl_snaps ...)` correlated per game
      // times out against 11.6M rows across 27 partitions; collapsing to the
      // ~3,300 distinct esbids first and joining runs in about a second.
      const { rows } = await db.raw(
        `
        with snap_games as (
          select distinct esbid from nfl_snaps
        )
        select
          g.season_year,
          g.season_type,
          g.week,
          count(*) as denominator,
          count(sg.esbid) as numerator
        from nfl_games g
        left join snap_games sg on sg.esbid = g.esbid
        where g.season_year >= 2016
          and g.week is not null
          and g.status like 'FINAL%'
        group by 1, 2, 3
        `
      )

      return rows.map((/** @type {Record<string, any>} */ row) => ({
        season_year: row.season_year,
        season_type: row.season_type,
        week: row.week,
        numerator: Number(row.numerator),
        denominator: Number(row.denominator)
      }))
    },
    precondition: (/** @type {Record<string, any>} */ row) =>
      Number(row.denominator) >= 8,
    min_rate: 1.0,
    calibration:
      'EXACT, not a tolerance: a FINAL game either has snap rows or it does not. Measured 2026-08-26 across 208 gradeable weeks from 2016 (259 in range before the eight-game precondition): fifth percentile 1.0000, and only FOUR weeks short of full coverage. Two were the live defect this was written for — 2026 PRE week 2 at 0.0000, all sixteen games, and 2026 PRE week 1 at 0.6875 — and BOTH ARE NOW REPAIRED and grade 1.0000. Their cause is worth keeping, because the check earned its place by catching it: the NFL Pro login had been failing since 2026-08-16, and it went unread for eleven days because both importers ended main() with a bare process.exit(), so the ledger recorded seven consecutive SUCCESSES over a credential importing nothing. The re-auth is now automated, the exit contract is honest, and the repair needed one lever beyond that — a pfSense pass rule, because the token mint runs on base-storage and LAN egress is default-deny on the proxy port. The other two weeks are single stranded games and are now PARKED as adjudicated rather than open: 2021 PRE week 3, where NFL Pro returns no plays at all for 2021082855, and 2016 PRE week 4, where 2016083151 returns all 176 plays with an empty nflIds array on every one. Both are upstream absence that no re-import can clear. The 2016 floor is where nfl_snaps coverage begins; grading earlier would report a decade of absence no repair can clear. Every one of the four is PRESEASON, the season_type every scheduled path treats as optional.',
    min_gradeable_units: 150,
    repair_command:
      'The writer is private/scripts/import-plays-nfl-pro.mjs (nfl_snaps is a side effect of ngs.save_play_data), NOT import-gamelogs-ngs.mjs, and it runs on base-storage under user:scheduled-command/league/import-nfl-pro-plays-preseason.md — not on the league host, which has neither cloak-browser nor the NFL Pro credential. Re-run it there: ssh base-storage, then run-league-import private/scripts/import-plays-nfl-pro.mjs --year <year> --week <week> --seas_type <type> --ignore_cache. A LIVE finding is most likely a dead NFL Pro session rather than anything about the week: the failure is NEEDS_OPERATOR_LOGIN, re-auth is operator-attended, and it must be driven from the pro.nfl.com origin — cloak-browser relay --profile nfl-pro-cloakbrowser, sign in at https://pro.nfl.com/, then ALWAYS cloak-browser close --profile nfl-pro-cloakbrowser, because killing the transport does not persist the session. After the snaps land, re-run node scripts/generate-player-snaps.mjs --year <year> --week <week> --season_type <type>, or the rows will import and stay unaggregated.'
  },

  {
    check_id: 'play-type-enrichment-coverage',
    invariant:
      'Every graded week carries the derived play_type on nearly all of its plays. play_type is written by the enrichment pass in scripts/process-plays.mjs, NOT by the play importers, so a week whose plays imported cleanly and were never enriched holds a full set of rows with the derived column NULL. No importer oracle can see that — the import succeeded — and every consumer filters on play_type, so the week silently contributes zero offensive plays instead of raising.',
    grain: ['season_year', 'season_type', 'week'],
    rows: async () =>
      db('nfl_plays')
        .select('season_year', 'season_type', 'week')
        .count('* as denominator')
        .select(db.raw('count(play_type) as numerator'))
        .where('season_year', '>=', 2001)
        .whereNotNull('week')
        .groupBy('season_year', 'season_type', 'week'),
    precondition: (/** @type {Record<string, any>} */ row) =>
      Number(row.denominator) >= 100,
    min_rate: 0.5,
    calibration:
      'Measured 2026-08-26 across 644 gradeable weeks: median 1.0000, first percentile 0.9021, fifth percentile 0.9177. The healthy floor is 0.8564 (2023 PRE week 0) and the whole low band is preseason, which carries a higher share of structural rows — TIMEOUT, END_QUARTER, GAME_START — that legitimately hold no derived play_type. Exactly ONE unit in the corpus sits below that band, and it is the defect: 2024 PRE week 3 at 0.0000, all 2,964 plays unenriched including 1,884 the NFL feed itself labels PASS or RUSH, with play_stats present for every one of them. The floor is set on that gap — 35 points under the worst healthy reading and 50 above the defect — deliberately far from the healthy band, because this detector exists to catch an enrichment pass that never RAN, not to police the ordinary structural-row share. A week drifting to 0.7 is unattested in 25 years of corpus and would be a new condition worth reading rather than a threshold to loosen. NOTE the sibling column play_type_nfl cannot be used as this probe: it is absent for all of 2023 preseason and for 2022 PRE week 3, so grading on it would report a decade of false findings.',
    min_gradeable_units: 500,
    repair_command:
      'Re-run the enrichment pass for the week: node scripts/process-plays.mjs --year <year> --week <week> --season_type <type>. Confirm nfl_play_stats holds rows for those games first — enrichment derives play_type from play stats, so it is a no-op against a week whose stats never imported, and that is a plays-import repair rather than this one.'
  },

  {
    check_id: 'gamelog-snaps-unaggregated',
    invariant:
      'Every player_gamelogs row whose player took a recorded snap in that same game carries a snap count. The snap columns are written by ONE script (scripts/generate-player-snaps.mjs) in a pass separate from the one that creates the rows, and they are NULL both when that pass fails and when it was never invoked for the week at all. Every consumer reads NULL as zero participation, so an unaggregated week does not error, does not log and does not read as missing — it reads as a week in which nobody played a snap.',
    grain: ['season_year', 'season_type', 'week'],
    rows: async () => {
      // The denominator is deliberately the RESOLVABLE population, not every
      // gamelog row: a row whose player carries no gsis_it_player_id, or who
      // took no snap in that game, is one the generator cannot write and must
      // not be graded against. Anchoring on the same esbid rather than on the
      // week keeps a player who changed teams mid-week from matching the wrong
      // game.
      const { rows } = await db.raw(
        `
        with snap_players as (
          select distinct esbid, gsis_it_player_id from nfl_snaps
        )
        select
          g.season_year,
          g.season_type,
          g.week,
          count(*) as denominator,
          count(pg.snaps_offense) as numerator
        from nfl_games g
        join player_gamelogs pg on pg.esbid = g.esbid
        join player pl on pl.pid = pg.pid and pl.gsis_it_player_id is not null
        join snap_players sp
          on sp.esbid = pg.esbid
         and sp.gsis_it_player_id = pl.gsis_it_player_id
        where g.week is not null
        group by 1, 2, 3
        `
      )

      return rows.map((/** @type {Record<string, any>} */ row) => ({
        season_year: row.season_year,
        season_type: row.season_type,
        week: row.week,
        numerator: Number(row.numerator),
        denominator: Number(row.denominator)
      }))
    },
    precondition: (/** @type {Record<string, any>} */ row) =>
      Number(row.denominator) >= 100,
    min_rate: 0.9,
    calibration:
      'Measured 2026-08-26 across 236 gradeable weeks: median 1.0000, fifth percentile 0.9923, and the healthy band bottoms out at 0.9277. Below it sit six units in two distinct shapes. The TOTAL failures are 2024 PRE weeks 1, 2 and 3 and 2026 PRE week 1, every one of them exactly 0.0000 — the generator never ran for those weeks, and the 2026 reading was LIVE when this check was written, two years after the 2024 one went unnoticed. The PARTIAL failures are 2023 POST week 1 at 0.7684 and 2023 REG week 18 at 0.8745. The floor sits three points under the healthy minimum and thirteen above the worst partial, which is the gap it is calibrated on. The 2025 REG cluster at 0.9277-0.9351 (weeks 5, 7, 10 and 14) is deliberately left GREEN: four weeks in one season sharing one narrow band reads as roster churn within the resolvable population rather than a failed pass, and pulling the floor above it would trade one real class for four rows nobody can repair. A reading of exactly 0.0000 is never ambiguous and is what this check exists for.',
    min_gradeable_units: 180,
    repair_command:
      'Re-run the aggregation for the week: node scripts/generate-player-snaps.mjs --year <year> --week <week> --season_type <type>. It upserts on (esbid, pid, season_year) and merges, so re-running a healthy week is safe. If the rate comes back 0.0000 again, check that nfl_plays holds ENRICHED rows for those games first — the generator left-joins nfl_plays and filters `whereNot play_type NOPL`, which under three-valued logic drops every snap whose play row is missing or unenriched, so an enrichment gap presents here as a snap gap. play-type-enrichment-coverage owns that upstream condition.'
  },

  {
    check_id: 'betting-market-game-prop-column-resolution',
    invariant:
      'Every player the betting-market tables hold a game prop for in a given week is a player the player game-prop data-view COLUMN returns a value for. league 6e724c02c turned on an inner nfl_games join for six player game-prop columns that had emitted none at any clock, and a newly-enabled inner join that is wrong presents as an EMPTY column — no error, no failing test, no log line. Nothing else can see it: test/data-views.betting-market-grain.spec.mjs asserts the join is emitted, which is a claim about the SQL rather than about what it resolves, and CI runs against a throwaway database holding no betting markets at all. This is the only oracle that executes the shipped column against real markets.',
    grain: ['season_year', 'season_type', 'week'],
    // Grades the previous season alongside the current one. The prior season is
    // what makes the check non-vacuous BEFORE the live season has props: a
    // detector whose whole population has not arrived yet cannot be shown to
    // work, and the first run that could tell you anything would be the first
    // run that matters. See the module header for the numerator/denominator
    // split — the numerator comes from the shipped column, the denominator from
    // raw SQL that never touches a column definition.
    rows: async () => game_prop_column_resolution_rows(),
    min_rate: 1.0,
    calibration:
      'EXACT, not a tolerance: a player the markets hold a game prop for either comes back from the column or does not, so the healthy reading is 1.0 and min_rate 1.0 is a live invariant rather than a percentile. Measured 2026-08-28 against production: the 2025 corpus grades 21 week-units (18 REG, 3 POST) at denominators of 4 to 33 players, every one of them 1.0000 — 2025 REG week 3 resolves 32 of 32, confirmed by executing the emitted SQL of the column itself. The 2026 unit is the one this check exists for and it is UN-GRADEABLE today, which is the state that must never read as a pass: prop_markets_index holds 640 selections for 2026 REG week 1 linked to nfl_games, but every one is a TEAM market (GAME_SPREAD, GAME_MONEYLINE, GAME_ALT_SPREAD) whose selection_pid is one of the 32 team pids and whose selection_type is null, so the player-prop population is genuinely 0 and there is nothing to resolve. It becomes gradeable on its own, with no calendar reminder and no code change, the week real player game props land. THE DEFECT THIS IS CALIBRATED AGAINST is a numerator of 0 against a non-zero denominator — the join annihilating the row set — which is what removing the nfl_games join, or gating it on the truthiness of a week again, produces. A partial reading is a different and rarer condition: the reference admits only selections whose pid we carry in `player`, so a numerator between 1 and the denominator means the column resolved some players of one week and not others, which is a join predicate that is wrong rather than absent.',
    // 21 units in the 2025 corpus and 19 in 2024, so 15 sits under the smallest
    // observed season and far above a scan that has stopped reaching the
    // markets tables. The live week is deliberately NOT counted on: it is
    // un-gradeable for most of the year by design, and a floor that depended on
    // it would collapse every offseason.
    min_gradeable_units: 15,
    // No min_denominator. The row count is not fixed by construction and the
    // smallest legitimate population is genuinely small — 2025 POST week 3 has
    // four passers because four teams were still playing — so any floor above
    // it would report a real week as un-gradeable forever.
    repair_command:
      'Confirm the direction before touching anything. A numerator of 0 against a non-zero denominator is the COLUMN, not the data: execute the emitted SQL for the failing week (get_data_view_results_query with an explicit {year, seas_type, week}) and check that the prop_markets_index CTE still carries its inner join to nfl_games on esbid, season_year, season_type and week. That join is the change 6e724c02c shipped and the one this check watches. A denominator that has fallen to 0 for a week that used to grade is the opposite condition and belongs to the odds importer — check the runs ledger for the FanDuel market import rather than reading it as a column defect.'
  },

  {
    check_id: 'betting-market-game-prop-line-differential',
    invariant:
      'Where the base tables hold DIFFERENT lines for a player in two adjacent weeks of the same season, the player game-prop data-view COLUMN renders different lines in those weeks, and where they hold the same line, it renders the same. A week-scoped column can resolve the right player SET and still lie about values: a CTE pinned to the first requested week broadcasts that week line onto every week row, and the resolution check (betting-market-game-prop-column-resolution) grades such a column 1.0000 because the players it returns are exactly right. That was the shape of the live report the week-scope migration fixed (league fc4a84ca0): every player 2024 prop line identical across weeks 1 and 2. Nothing else can see the value dimension: the query-match fixtures normalize against the column build, and CI runs against a throwaway Postgres holding no betting markets at all, so the only place the question can be answered is a production run against real adjacent-week markets.',
    grain: ['season_year', 'season_type', 'week_b'],
    rows: async () => game_prop_line_differential_rows(),
    min_rate: 1.0,
    calibration:
      'EXACT agreement, not a tolerance. A compared player is one with an unambiguous base line in both weeks (a week holding duplicate markets at different lines has no single reference line and is excluded) that the shipped column resolved in both weeks; it is a disagreement when column-diff and ref-diff disagree, so min_rate 1.0 is a live invariant and the healthy reading is 1.0. FALSE, the reading this check exists for, is the broadcaster: it renders every compared player equal, so each adjacent-week pair reads 0/N however many players it resolves — the count of players comes from the resolution check, the VALUE comes from here, and the two never overlap because a player the column dropped from a week is not compared. A player the base holds equal across the pair but the column renders different is the same disagreement from the other side and counts the same way. The seeded corpus (data-checks.game-prop-column-resolution.spec.mjs) drives a differer and an equal-lines control through 2025 REG weeks 13 and 14.',
    min_gradeable_units: 15,
    // The floor mirrors the resolution check: a prior season (2025 REG) produces
    // 17 adjacent pairs plus 2-3 postseason, so 15 sits under the
    // smallest observed season while far above a scan that stopped reaching the
    // markets tables. The current season contributes pairs only once it has two
    // weeks of player props, and is expected to be absent early on.
    repair_command:
      'Confirm the direction before touching anything. A disagreement is the COLUMN, not the data: execute the column over the failing pair (get_data_view_results with single_nfl_week_id naming both weeks, row_axes year+week) and check whether every player renders the same line in both weeks while the base tables hold different selections — that is the broadcast signature of a CTE pinned to one week, the class fc4a84ca0 migrated. A disagreement on a player whose base week holds duplicate markets at different lines is the reference ambiguity, not a broadcast: the differential excludes such weeks, so a finding there means the population the check scanned diverged from the column, and the odds importer or the market dedup policy owns it rather than the column.'
  },

  {
    check_id: 'scoring-format-gamelog-completeness',
    invariant:
      'Every scoring format holds exactly the (pid, esbid) set that player_gamelogs restricted to fantasy primary positions produces for a season — no missing rows and no extra ones. Row presence is format-INDEPENDENT by construction: the generator takes its row set from player_gamelogs and nothing on the insert path consults the format, which decides the points VALUE and never which rows exist. No other oracle sees this. The generation scripts report success per run, and --only-missing asks whether a format has ANY row rather than the right ones, so a format can sit years out of date while every job it belongs to reports green.',
    grain: ['season_year', 'scoring_format_id'],
    rows: async () => scoring_format_gamelog_completeness_rows(),
    // A season is gradeable only where we hold gamelogs to grade against. The
    // reference IS player_gamelogs, so a season it does not cover has no
    // expectation to compare a format to and must not read as a pass.
    precondition: (/** @type {Record<string, any>} */ row) =>
      Number(row.expected_n) > 0,
    min_rate: 1.0,
    calibration:
      'EXACT, not a tolerance: the two sets are either identical or they are not, so 1.0 is a live invariant rather than a percentile. WHY INTERSECTION OVER UNION — the two real defects point in opposite directions and stored/expected can only see one. Missing rows: 2025 genesis held 8,775 against an expectation of 11,413, because it was the one format not regenerated after a player_gamelogs backfill added inactive-player rows. Extra rows: every other format held 11,804 for 2025, 391 of them for players whose primary_position has since left fantasy_positions, and stored/expected scores that at 1.03 and passes it. Intersection over union makes both fall below the floor. MEASURED 2026-08-28 against production, mid-repair and therefore almost entirely red: 1,675 units (67 catalog formats x 25 seasons), 1,655 below 1.0, minimum denominator 5,881 (2001), runtime 89s. The shortfalls were not subtle — 2016 stored 7,107 against 11,128 expected and 2023 stored 7,327 against 11,168 — because the gamelogs arm of --only-missing treated a per-GAME table as year-agnostic, so one row from any season read as "this step has run" and the format was skipped forever. The healthy reading after the regeneration is every unit at exactly 1.0000. FOUR UNITS PER SEASON ARE EXPECTED TO STAY RED until the catalog is cleaned: a6bbae3f-08fb-431b-893e-a993e52f471c and c057f2a9-cc6a-47b3-9bb8-e95455e3addc are unreferenced UUID duplicates of sfb15_mfl and sfb15_sleeper left behind by the format-id migration, holding zero rows and zero league_formats and zero seasons. They are deliberately NOT parked — a catalog row nothing references and nothing generates is a real defect, and parking it would convert a two-row cleanup into a permanent adjudication.',
    // 1,675 units today and the season axis only grows; 1,200 sits below the
    // 1,625 the count falls to if the two orphaned catalog rows are dropped,
    // and far above a scan that has stopped reaching player_gamelogs.
    min_gradeable_units: 1200,
    // REQUIRED here: the row count is very nearly fixed by construction
    // (catalog formats x seasons), so min_gradeable_units cannot fall even if
    // the scan returns nothing, and only the denominator moves. The smallest
    // observed is 5,881 for 2001, the shortest season in the corpus.
    min_denominator: 3000,
    repair_command:
      'Regenerate the failing format for the failing season, then re-grade: NODE_ENV=production node scripts/generate-scoring-format-player-gamelogs.mjs --scoring_format_id <id> --year <year>. Drop --year for every season. A rate of exactly 0 against a full denominator means the format was never generated at all rather than gone stale — check it exists in league_scoring_formats and is referenced by a league_format before generating 25 seasons of data for it. The derived seasonlogs and careerlogs read FROM this table, so any repair here must be followed by generate-scoring-format-player-seasonlogs.mjs and generate-scoring-format-player-careerlogs.mjs for the same format.'
  }
]

export default registry
