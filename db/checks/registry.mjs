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
    min_gradeable_units   detector-health floor -- fewer THROWS
    repair_command        goes in the finding message

  ## Two rules that are easy to get wrong

  Every `rows` function MUST return `denominator` as the population it SCANNED,
  including on a `max_count` check where `numerator` is the violation count.
  Without it the detector-health floor fires precisely when the corpus is clean.

  Calibrate on the GAP between normal and defective, never on the worst normal
  reading, and re-measure immediately before changing a threshold. Every figure
  in a `calibration` string below is a reading taken at one instant against a
  corpus other people are actively repairing.
*/

import db from '#db'

import { recompute_route_share } from '#libs-server'
import { pfr_gamelog_agreement_rows } from '#libs-server/pfr-gamelog-agreement.mjs'

// The four gamelog child tables. Generic over the parent-child edge rather than
// receiving-specific, because a receiving-only detector missed the 30 defender
// rows a sibling repair found.
const GAMELOG_CHILD_TABLES = [
  'player_receiving_gamelogs',
  'player_rushing_gamelogs',
  'player_passing_gamelogs',
  'player_defender_gamelogs'
]

// Every external identifier column on `player`. A shell row is one holding NONE
// of them. Enumerated rather than derived from information_schema at runtime: a
// derived list silently changes the predicate's meaning when a column is added,
// which is the same class of defect as a registry-derived CTE identity key.
const PLAYER_EXTERNAL_ID_COLUMNS = [
  'cbs_player_id',
  'cfbref_player_id',
  'draftkings_player_id',
  'esb_player_id',
  'espn_player_id',
  'fanduel_player_id',
  'fantasy_data_player_id',
  'fantasylabs_player_id',
  'fantasypoints_player_id',
  'fantrax_player_id',
  'ffpc_player_id',
  'fleaflicker_player_id',
  'gsis_it_player_id',
  'gsis_player_id',
  'keeptradecut_player_id',
  'mfl_player_id',
  'nffc_player_id',
  'nfl_player_id',
  'otc_player_id',
  'pff_player_id',
  'pfr_player_id',
  'rotowire_player_id',
  'rotoworld_player_id',
  'rts_player_id',
  'sis_player_id',
  'sleeper_player_id',
  'smart_player_id',
  'sportradar_player_id',
  'sumer_player_id',
  'swish_player_id',
  'underdog_player_id',
  'yahoo_player_id'
]

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
    precondition: (row) =>
      row.our_games > 0 && row.reference_games === row.our_games,
    min_rate: 1.0,
    calibration:
      '2022 grades 221 units across 17 admitted weeks and 13 stat fields: median 1.0000, zero below 0.99, minimum 0.9984 at week 8 receptions (635 ours against 636). 2024 weeks 1-2 grade at 26 units with 25 exactly 1.0000, read from the per-GAME box scores because the cache holds no 2024 season file. 2025 admits one week of seven, which is the precondition working. Sensitivity: one missing game in a 16-game week reads about 0.94 and the 2021 week 15 defect shape (9 of 16 games) reads about 0.44, so a single missing game is detectable. min_rate is ONE-SIDED and this comparison is two-sided — a ratio above 1.0 passes silently, so the reference-completeness precondition is the only thing catching a reference that is BEHIND ours, and grading a partial 2025 without it produced ratios up to 5.5. FUMBLES_LOST IS THE ONE FIELD THAT ALWAYS SITS ABOVE 1.0, and it is left gradeable deliberately: measured 2026-08-14, every one of the 15 gradeable units exceeding the reference is fumbles_lost (2022 weeks 2-14 and 18, 2024 week 1, 2025 week 5), ours always the larger side, because PFR credits the fumbling player only where the recovering team gained possession while our feed counts every fumble the fumbling team did not recover. That definitional gap can only push OUR side up, which min_rate cannot see — so keeping the field costs nothing and preserves the direction that is a real defect, a week where we are MISSING lost fumbles. Parking it would have meant 15 entries repeating one reason, which is a baseline wearing an adjudication’s schema.',
    min_gradeable_units: 150,
    repair_command:
      'Identify the missing or mis-attributed games for the week, then re-import: node scripts/import-plays-nflfastr.mjs --season_year <year> --week <week>'
  },

  {
    check_id: 'nflfastr-dropback-coverage',
    invariant:
      'Every graded week carries is_qb_dropback on nearly all of its plays. The importer’s own match rate is season-grained, so a nine-game hole is about 2 percent of its denominator and can never breach any floor.',
    grain: ['season_year', 'week', 'season_type'],
    rows: async () => {
      const rows = await db('nfl_plays')
        .select('season_year', 'week', 'season_type')
        .count('* as denominator')
        .select(db.raw('count(is_qb_dropback) as numerator'))
        .where('season_year', '>=', 1999)
        .whereIn('season_type', ['REG', 'POST'])
        .whereNotNull('week')
        .groupBy('season_year', 'week', 'season_type')

      // A week below this is a scheduling artifact rather than a gradeable
      // population, which is a precondition in all but name and is why this
      // check declares none of its own.
      return rows.filter((row) => Number(row.denominator) >= 100)
    },
    min_rate: 0.8,
    calibration:
      'The one threshold here that is a genuine TOLERANCE rather than a target: nflfastR does not enrich every play by design. Across 533 graded weeks measured 2026-08-14 the median is 0.9540 and the minimum is 0.8493, with zero weeks below the floor; the one real defect this was written for (2021 REG week 15, before repair) sat at 0.425. The floor is six points under the healthy minimum and thirty-seven above the defect — calibrated on the gap, not on the worst normal reading. PRE is excluded because nflfastR publishes REG and POST only, so grading it would put roughly 100 permanently-red weeks in front of the one that is real.',
    min_gradeable_units: 400,
    repair_command:
      'node scripts/import-plays-nflfastr.mjs --season_year <year> --week <week>'
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
          ? orphans.map((row) => ({
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

      return [
        {
          scope: 'all',
          numerator: result.updated,
          denominator: result.candidates,
          skipped_missing_dropbacks: result.skipped_missing_dropbacks,
          skipped_invalid_dropbacks: result.skipped_invalid_dropbacks
        }
      ]
    },
    max_count: 0,
    calibration:
      'Exact: any row the healer can fill right now is a row the recompute pass failed to reach, so the healthy reading is zero fillable against a non-zero candidate population. Grain is `all` rather than per-season because recompute_route_share returns four global scalars with no season breakdown; delivering a per-season grain means either N calls or changing a healer shared with two other scripts, which is a separate change. The rows the healer SKIPS are deliberately not this finding — they are the upstream dropback gap that nflfastr-dropback-coverage owns, and counting them here would report one condition twice and leave this key permanently open.',
    min_gradeable_units: 1,
    repair_command: 'node scripts/recompute-route-share.mjs'
  },

  {
    check_id: 'duplicate-person-rows',
    invariant:
      'No person holds both a populated canonical `player` row and a near-empty shell row. Repaired five times across db/adhoc dedupe rounds with NO detector on any surface — no audit script, no gate, no monitoring script grades it — and it is the exact inverse of the conflated-identity class, whose half does have a wired gate.',
    grain: ['pid'],
    rows: async () => {
      // One statement rather than a builder chain: the predicate is a self-join
      // with a per-row aggregate over 32 columns on both sides, which knex
      // cannot express without re-spelling the identifier list twice.
      const id_expression = (alias) =>
        `num_nonnulls(${PLAYER_EXTERNAL_ID_COLUMNS.map((column) => `${alias}.${column}`).join(', ')})`

      const { rows: found } = await db.raw(
        `
        with id_counts as (
          select p.pid, p.formatted_name, p.college, ${id_expression('p')} as id_count
          from player p
        ),
        shells as (
          select c.* from id_counts c
          where c.id_count = 0
            and not exists (select 1 from player_gamelogs g where g.pid = c.pid)
        )
        select distinct s.pid
        from shells s
        join id_counts k
          on k.formatted_name = s.formatted_name
         and k.pid <> s.pid
         and k.id_count >= 2
         and (k.college = s.college or k.college is null or s.college is null)
        `
      )

      const [scanned] = await db('player').count('* as count')
      const denominator = Number(scanned.count)

      return found.length
        ? found.map((row) => ({ pid: row.pid, numerator: 1, denominator }))
        : [{ pid: null, numerator: 0, denominator }]
    },
    max_count: 0,
    calibration:
      'Measured 2026-08-14: 24 candidate shell rows against 27,748 player rows scanned. The predicate is RECONSTRUCTED from the prose specification in the header of db/adhoc/2026-08-04-dedupe-duplicate-person-rows.sql — no dedupe round contains the sweep SQL, only a hardcoded merge_map — and validated by reproducing that round’s two arms in ratio rather than in absolute count: it measured 150 strict-college and 242 relaxed, today 14 and 24, both scaled together. It is sharply sensitive to the twin threshold: requiring the twin to hold TWO or more identifiers gives 24, one or more gives 60, and the round specifies two. The class RECURS BY CONSTRUCTION, which is why a sixth one-shot repair would not settle it: round 4 records that repairing two corrupt birth dates in round 3 made two further pairs agree on a date they had never agreed on, so each repair mints the next round’s findings and nothing watches in between. A finding here is a CANDIDATE for adjudication, never an automatic merge — fathers, sons and namesakes sit in the same predicate.',
    min_gradeable_units: 1,
    repair_command:
      'Adjudicate each pair on date_of_birth (nfl_draft_year is corrupt on exactly these rows and cannot discriminate), then write a dated merge file under db/adhoc/ following the shape of 2026-08-05-dedupe-residual-round-4.sql'
  }
]

export default registry
