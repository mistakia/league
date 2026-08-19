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
    precondition: (/** @type {Record<string, any>} */ row) =>
      row.our_games > 0 && row.reference_games === row.our_games,
    min_rate: 1.0,
    calibration:
      '2022 grades 221 units across 17 admitted weeks and 13 stat fields: median 1.0000, zero below 0.99, minimum 0.9984 at week 8 receptions (635 ours against 636). 2024 weeks 1-2 grade at 26 units with 25 exactly 1.0000, read from the per-GAME box scores because the cache holds no 2024 season file. 2025 admits one week of seven, which is the precondition working. WHAT THIS CHECK CAN AND CANNOT SEE: the precondition demands `reference_games === our_games`, and `our_games` counts the distinct games we hold gamelogs for — so a week where we are missing a WHOLE GAME fails the precondition and is reported un-gradeable, never as a finding. What it grades is disagreement WITHIN the games both sides cover: a missing or mis-attributed player row moves the ratio while the game count stays equal, which is the defect class this catches and the reason the grain is (season_year, week, stat) rather than the game. A prior version of this prose claimed a single missing game reads about 0.94 and is detectable; that is false against the shipped precondition, and simulating it confirms the week goes un-gradeable with zero findings. Whole-game absence is unowned by this registry — one such week costs 13 of about 260 gradeable units, nowhere near the floor, so it is invisible here rather than merely un-graded. min_rate is ONE-SIDED and this comparison is two-sided — a ratio above 1.0 passes silently, so the reference-completeness precondition is the only thing catching a reference that is BEHIND ours, and grading a partial 2025 without it produced ratios up to 5.5. FUMBLES_LOST IS THE ONE FIELD THAT ALWAYS SITS ABOVE 1.0, and it is left gradeable deliberately: measured 2026-08-14, every one of the 15 gradeable units exceeding the reference is fumbles_lost (2022 weeks 2-14 and 18, 2024 week 1, 2025 week 5), ours always the larger side, because PFR credits the fumbling player only where the recovering team gained possession while our feed counts every fumble the fumbling team did not recover. That definitional gap can only push OUR side up, which min_rate cannot see — so keeping the field costs nothing and preserves the direction that is a real defect, a week where we are MISSING lost fumbles. Parking it would have meant 15 entries repeating one reason, which is a baseline wearing an adjudication’s schema.',
    min_gradeable_units: 150,
    repair_command:
      'Identify the missing or mis-attributed PLAYER rows within the week — a whole missing game fails this check’s precondition and is reported un-gradeable rather than as this finding — then re-import: node scripts/import-plays-nflfastr.mjs --season_year <year> --week <week>'
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
    check_id: 'duplicate-person-rows',
    invariant:
      'No person holds both a populated canonical `player` row and a near-empty shell row. Repaired five times across db/adhoc dedupe rounds with NO detector on any surface — no audit script, no gate, no monitoring script grades it — and it is the exact inverse of the conflated-identity class, whose half does have a wired gate.',
    grain: ['pid'],
    rows: async () => {
      // One statement rather than a builder chain: the predicate is a self-join
      // with a per-row aggregate over 32 columns on both sides, which knex
      // cannot express without re-spelling the identifier list twice.
      const id_expression = (/** @type {string} */ alias) =>
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
        ? found.map((/** @type {Record<string, any>} */ row) => ({
            pid: row.pid,
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
      'MOST FINDINGS HERE ARE NOT DUPLICATES — measured 2026-08-16, 19 of 24 were different people, overwhelmingly father/son and namesake pairs decades apart (Chickillo, Dorsett and Zordich Sr/Jr; Deacon Jones against a 2011 tackle). Adjudicate every pair on date_of_birth before merging anything (nfl_draft_year is corrupt on exactly these rows and cannot discriminate); a gap of more than a few years is a different person. Park those in db/checks/parked.json as adjudicated. Merge only the remainder, in a dated file under db/adhoc/ following the shape of 2026-08-16-dedupe-duplicate-person-rows-round-5.sql — round 5 rather than round 4, whose hand-written column list names three columns a later conform renamed away and silently drops any column added since it was written.'
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
  }
]

export default registry
