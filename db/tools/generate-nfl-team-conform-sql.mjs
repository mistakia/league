/*
  Generates the two team-abbreviation conform adhoc files from the era module,
  so no boundary year or alias is transcribed by hand. Run from the repo root:

    node db/tools/generate-nfl-team-conform-sql.mjs

  Scratch tooling, not committed -- the generated .sql files are the artifact
  and db/adhoc is append-only.
*/

import { writeFileSync } from 'fs'

import {
  nfl_team_franchise_eras,
  nfl_team_spelling_aliases
} from '#libs-shared/nfl-team-franchise-eras.mjs'

const q = (v) => `'${String(v).replace(/'/g, "''")}'`
const yr = (v) => (v === null ? 'NULL::int' : String(v))

const era_values = nfl_team_franchise_eras
  .map(
    (e) =>
      `  (${q(e.era_nfl_team)}, ${e.start_year}, ${yr(e.end_year)}, ${q(e.canonical_nfl_team)})`
  )
  .join(',\n')

const alias_values = Object.entries(nfl_team_spelling_aliases)
  .map(([a, c]) => `  (${q(a)}, ${q(c)})`)
  .join(',\n')

/*
  The resolution expression, mirroring resolve_canonical_nfl_team's documented
  order: the (token, season) range FIRST, then the vendor spelling alias, then
  the token itself.

  The resolver puts the canonical-identity case between the range and the
  alias; collapsing it into the final COALESCE arm here is equivalent, because
  no alias is a canonical token -- asserted in
  test/libs-shared.nfl-team-franchise-eras.spec.mjs so the equivalence is
  enforced rather than assumed.

  An UNMODELLED token also falls to the final arm and resolves to itself, so it
  is never rewritten. That is deliberate: the pre-flight below counts those
  rows and this file leaves them alone rather than guessing.
*/
const resolve = (token, year) => `COALESCE(
        (SELECT e.canonical_nfl_team FROM conform_era e
          WHERE e.era_nfl_team = ${token}
            AND ${year} >= e.start_year
            AND (e.end_year IS NULL OR ${year} <= e.end_year)),
        (SELECT a.canonical_nfl_team FROM conform_alias a WHERE a.alias = ${token}),
        ${token}
      )`

const reference_block = `SET lock_timeout = '30s';
SET statement_timeout = 0;

-- The franchise-era table and the vendor spelling aliases, GENERATED from
-- libs-shared/nfl-team-franchise-eras.mjs rather than transcribed, so this file
-- and the resolver every importer calls cannot disagree about a boundary year.
CREATE TEMP TABLE conform_era (
  era_nfl_team text NOT NULL,
  start_year int NOT NULL,
  end_year int,
  canonical_nfl_team text NOT NULL
) ON COMMIT DROP;

INSERT INTO conform_era VALUES
${era_values};

CREATE TEMP TABLE conform_alias (
  alias text NOT NULL,
  canonical_nfl_team text NOT NULL
) ON COMMIT DROP;

INSERT INTO conform_alias VALUES
${alias_values};
`

const play_columns = [
  'possession_nfl_team',
  'offense_nfl_team',
  'defense_nfl_team',
  'yard_line_side',
  'score_team',
  'touchdown_nfl_team',
  'return_nfl_team',
  'penalty_team',
  'timeout_team'
]

const assert_count = ({ label, query, expected }) => `
DO $$
DECLARE actual bigint;
BEGIN
  SELECT ${query} INTO actual;
  IF actual <> ${expected} THEN
    RAISE EXCEPTION '${label}: expected ${expected}, found %', actual;
  END IF;
  RAISE NOTICE '${label}: % (as expected)', actual;
END $$;
`

// ---------------------------------------------------------------- D: 2000 on

const d = `-- STATUS: PENDING
--
-- Conform NFL team abbreviations to the CURRENT franchise abbreviation, 2000
-- onward. Increment D of user:task/league/settle-nfl-games-team-abbreviation-matching.md.
--
-- The operator ruled on 2026-09-02 that the current franchise abbreviation is
-- canonical for every NFL team column. This file rewrites the era tokens the
-- database still holds (SD, STL, RAM, RAI, PHO, BOS, plus the BAL Colts and HOU
-- Oilers collision slots) to that form, for seasons 2000 and later.
--
-- WHAT THIS IS NOT: it is not the fix for the 575 unmatched nflverse games.
-- Those were closed by the matcher alone in league 4406d19f2, with no data
-- write. This file serves the convention.
--
-- ATOMICITY. nfl_games and the WHOLE nfl_plays team-column set conform in one
-- transaction -- not just possession_nfl_team. fixed-drive-enrichment.mjs
-- compares offense_nfl_team to touchdown_nfl_team to classify a defensive
-- touchdown, so a split between those two renumbers fixed_drive for an entire
-- game. db:exec supplies the transaction; do NOT add BEGIN/COMMIT.
--
-- ROLLBACK. Not invertible by map (STL and RAM both collapse to LA, as do SD
-- and LAC) and not invertible by season either, because a pre-existing
-- canonical bleed of 12-36 plays per season is indistinguishable from a
-- conformed row afterwards. So the backups below are the rollback mechanism.
-- nfl_plays, nfl_games, player_gamelogs and player get keyed snapshots;
-- nfl_play_stats gets a FULL PHYSICAL COPY, because idx_24719_play_stat is
-- unique only in Postgres's NULL-permissive sense (5,804,248 rows against
-- 5,308,119 distinct values, player_name NULL on 1,216,509) and cannot say
-- which sibling held which team.
--
-- NOT REWRITTEN, deliberately:
--   * changelog tables -- audit history of what a value WAS, correct as-is
--   * the 40 non-franchise slots (AFC, NFC, IRV, RIC, SAN, CRT, INA)
--   * four EMPTY-STRING slots (2 nfl_plays 2021, 2 player_gamelogs 2024). An
--     empty team is an absence wearing a value, a different defect with a
--     different repair. The conformance check keeps reporting them.
--   * seasons before 2000 -- a separate franchise-identity ruling, increment E
--
-- Generated by db/tools/generate-nfl-team-conform-sql.mjs from
-- libs-shared/nfl-team-franchise-eras.mjs.

${reference_block}
-- ---------------------------------------------------------------------------
-- Pre-flight. Every one of these must hold BEFORE anything is written.
-- ---------------------------------------------------------------------------

-- The conform must not create a duplicate on idx_24707_game
-- (away_nfl_team, home_nfl_team, week, season_year, season_type). Re-checked
-- here rather than trusted from the planning session, because rows land
-- continuously.
${assert_count({
  label: 'PRE nfl_games idx_24707_game collisions after mapping',
  expected: 0,
  query: `count(*) FROM (
    SELECT ${resolve('g.away_nfl_team', 'g.season_year')} AS away_new,
           ${resolve('g.home_nfl_team', 'g.season_year')} AS home_new,
           g.week, g.season_year, g.season_type
    FROM nfl_games g
    GROUP BY 1, 2, 3, 4, 5
    HAVING count(*) > 1
  ) collisions`
})}
-- ---------------------------------------------------------------------------
-- Backups. Inside the transaction on purpose: if this file aborts there is
-- nothing to restore, and if it commits the backups commit with it.
-- ---------------------------------------------------------------------------

CREATE TABLE nfl_games_preconform_20260902 AS
  SELECT esbid, season_year, week, season_type, away_nfl_team, home_nfl_team
  FROM nfl_games
  WHERE season_year >= 2000
    AND (${resolve('away_nfl_team', 'season_year')} <> away_nfl_team
      OR ${resolve('home_nfl_team', 'season_year')} <> home_nfl_team);

CREATE TABLE nfl_plays_preconform_20260902 AS
  SELECT esbid, play_id, season_year, ${play_columns.join(', ')}
  FROM nfl_plays p
  WHERE ${play_columns
    .map((c) => `${resolve(`p.${c}`, 'p.season_year')} IS DISTINCT FROM p.${c}`)
    .join('\n     OR ')};

CREATE TABLE player_gamelogs_preconform_20260902 AS
  SELECT esbid, pid, season_year, nfl_team, opponent_nfl_team
  FROM player_gamelogs pg
  WHERE ${resolve('pg.nfl_team', 'pg.season_year')} IS DISTINCT FROM pg.nfl_team
     OR ${resolve('pg.opponent_nfl_team', 'pg.season_year')} IS DISTINCT FROM pg.opponent_nfl_team;

CREATE TABLE player_preconform_20260902 AS
  SELECT pid, nfl_draft_year, draft_team
  FROM player p
  WHERE p.nfl_draft_year >= 2000
    AND ${resolve('p.draft_team', 'p.nfl_draft_year')} IS DISTINCT FROM p.draft_team;

-- Full physical copy: this table has no usable row handle, so a keyed snapshot
-- cannot restore it. 1336 MB against 183 GB free.
CREATE TABLE nfl_play_stats_preconform_20260902 AS SELECT * FROM nfl_play_stats;

-- ---------------------------------------------------------------------------
-- The conform.
-- ---------------------------------------------------------------------------

UPDATE nfl_games g
SET away_nfl_team = ${resolve('g.away_nfl_team', 'g.season_year')},
    home_nfl_team = ${resolve('g.home_nfl_team', 'g.season_year')}
WHERE g.season_year >= 2000
  AND (${resolve('g.away_nfl_team', 'g.season_year')} <> g.away_nfl_team
    OR ${resolve('g.home_nfl_team', 'g.season_year')} <> g.home_nfl_team);

UPDATE nfl_plays p
SET ${play_columns
  .map((c) => `${c} = ${resolve(`p.${c}`, 'p.season_year')}`)
  .join(',\n    ')}
WHERE ${play_columns
  .map((c) => `${resolve(`p.${c}`, 'p.season_year')} IS DISTINCT FROM p.${c}`)
  .join('\n   OR ')};

UPDATE nfl_play_stats ps
SET nfl_team = ${resolve('ps.nfl_team', 'g.season_year')}
FROM nfl_games g
WHERE g.esbid = ps.esbid
  AND ${resolve('ps.nfl_team', 'g.season_year')} IS DISTINCT FROM ps.nfl_team;

UPDATE player_gamelogs pg
SET nfl_team = ${resolve('pg.nfl_team', 'pg.season_year')},
    opponent_nfl_team = ${resolve('pg.opponent_nfl_team', 'pg.season_year')}
WHERE ${resolve('pg.nfl_team', 'pg.season_year')} IS DISTINCT FROM pg.nfl_team
   OR ${resolve('pg.opponent_nfl_team', 'pg.season_year')} IS DISTINCT FROM pg.opponent_nfl_team;

UPDATE player p
SET draft_team = ${resolve('p.draft_team', 'p.nfl_draft_year')}
WHERE p.nfl_draft_year >= 2000
  AND ${resolve('p.draft_team', 'p.nfl_draft_year')} IS DISTINCT FROM p.draft_team;

-- ---------------------------------------------------------------------------
-- Post-conditions. An UPDATE matching zero rows is a SUCCESS, so these assert
-- the PROPERTY rather than trusting a clean exit.
-- ---------------------------------------------------------------------------

-- Every backup holds the rows it was supposed to capture.
${assert_count({
  label: 'POST nfl_games backup rows',
  expected: 668,
  query: 'count(*) FROM nfl_games_preconform_20260902'
})}${assert_count({
  label: 'POST nfl_plays backup rows',
  expected: 83126,
  query: 'count(*) FROM nfl_plays_preconform_20260902'
})}${assert_count({
  label: 'POST player_gamelogs backup rows',
  expected: 286,
  query: 'count(*) FROM player_gamelogs_preconform_20260902'
})}${assert_count({
  label: 'POST player backup rows',
  expected: 4,
  query: 'count(*) FROM player_preconform_20260902'
})}${assert_count({
  label: 'POST nfl_play_stats physical backup rows',
  expected: 5804248,
  query: 'count(*) FROM nfl_play_stats_preconform_20260902'
})}
-- ZERO residual era tokens from 2000 onward, asked through the same
-- season-first predicate the registered check uses.
${assert_count({
  label: 'POST residual non-conforming slots, 2000 onward',
  expected: 0,
  query: `count(*) FROM (
    SELECT 1 FROM nfl_games g WHERE g.season_year >= 2000
      AND (${resolve('g.away_nfl_team', 'g.season_year')} <> g.away_nfl_team
        OR ${resolve('g.home_nfl_team', 'g.season_year')} <> g.home_nfl_team)
    UNION ALL
    SELECT 1 FROM nfl_plays p WHERE ${play_columns
      .map(
        (c) => `${resolve(`p.${c}`, 'p.season_year')} IS DISTINCT FROM p.${c}`
      )
      .join('\n      OR ')}
    UNION ALL
    SELECT 1 FROM player_gamelogs pg
      WHERE ${resolve('pg.nfl_team', 'pg.season_year')} IS DISTINCT FROM pg.nfl_team
         OR ${resolve('pg.opponent_nfl_team', 'pg.season_year')} IS DISTINCT FROM pg.opponent_nfl_team
    UNION ALL
    SELECT 1 FROM nfl_play_stats ps JOIN nfl_games g ON g.esbid = ps.esbid
      WHERE ${resolve('ps.nfl_team', 'g.season_year')} IS DISTINCT FROM ps.nfl_team
    UNION ALL
    SELECT 1 FROM player p WHERE p.nfl_draft_year >= 2000
      AND ${resolve('p.draft_team', 'p.nfl_draft_year')} IS DISTINCT FROM p.draft_team
  ) residual`
})}
-- A relabel MOVES no rows. These are the population-level reconciliation that
-- is independent of the mapper: if any of them changed, something other than a
-- team abbreviation was rewritten.
${assert_count({
  label: 'POST nfl_games row count unchanged',
  expected: 15622,
  query: 'count(*) FROM nfl_games'
})}${assert_count({
  label: 'POST nfl_play_stats row count unchanged',
  expected: 5804248,
  query: 'count(*) FROM nfl_play_stats'
})}${assert_count({
  label: 'POST non-franchise slots still 40',
  expected: 40,
  query: `count(*) FROM (
    SELECT away_nfl_team AS t FROM nfl_games
    UNION ALL SELECT home_nfl_team FROM nfl_games
  ) s WHERE s.t IN ('AFC','NFC','IRV','RIC','SAN','CRT','INA')`
})}`

// ------------------------------------------------------------- E: pre-2000

const e = `-- STATUS: PENDING
--
-- Conform NFL team abbreviations to the CURRENT franchise abbreviation, before
-- 2000. Increment E of user:task/league/settle-nfl-games-team-abbreviation-matching.md.
--
-- THIS IS A FRANCHISE-IDENTITY RULING, NOT A MATCHING FIX, and it carried its
-- own operator gate separate from increment D. It relabels the 1975 Colts as
-- IND, the 1980 Oilers as TEN and the 1975 Cardinals as ARI, destroying a
-- historical label the system does not currently render. Approving the
-- abbreviation convention was NOT the same as approving this.
--
-- It is also the one part of this work with no live consumer: nfl_plays,
-- player_gamelogs and nfl_play_stats all begin at season 2000, so no pre-2000
-- row is joined by anything. Only nfl_games and player.draft_team are touched,
-- and there is no atomicity coupling -- no plays exist before 2000.
--
-- Generated by db/tools/generate-nfl-team-conform-sql.mjs from
-- libs-shared/nfl-team-franchise-eras.mjs.

${reference_block}
${assert_count({
  label: 'PRE nfl_games idx_24707_game collisions after mapping',
  expected: 0,
  query: `count(*) FROM (
    SELECT ${resolve('g.away_nfl_team', 'g.season_year')} AS away_new,
           ${resolve('g.home_nfl_team', 'g.season_year')} AS home_new,
           g.week, g.season_year, g.season_type
    FROM nfl_games g
    GROUP BY 1, 2, 3, 4, 5
    HAVING count(*) > 1
  ) collisions`
})}
CREATE TABLE nfl_games_preconform_pre2000_20260902 AS
  SELECT esbid, season_year, week, season_type, away_nfl_team, home_nfl_team
  FROM nfl_games
  WHERE season_year < 2000
    AND (${resolve('away_nfl_team', 'season_year')} <> away_nfl_team
      OR ${resolve('home_nfl_team', 'season_year')} <> home_nfl_team);

CREATE TABLE player_preconform_pre2000_20260902 AS
  SELECT pid, nfl_draft_year, draft_team
  FROM player p
  WHERE p.nfl_draft_year < 2000
    AND ${resolve('p.draft_team', 'p.nfl_draft_year')} IS DISTINCT FROM p.draft_team;

UPDATE nfl_games g
SET away_nfl_team = ${resolve('g.away_nfl_team', 'g.season_year')},
    home_nfl_team = ${resolve('g.home_nfl_team', 'g.season_year')}
WHERE g.season_year < 2000
  AND (${resolve('g.away_nfl_team', 'g.season_year')} <> g.away_nfl_team
    OR ${resolve('g.home_nfl_team', 'g.season_year')} <> g.home_nfl_team);

UPDATE player p
SET draft_team = ${resolve('p.draft_team', 'p.nfl_draft_year')}
WHERE p.nfl_draft_year < 2000
  AND ${resolve('p.draft_team', 'p.nfl_draft_year')} IS DISTINCT FROM p.draft_team;

${assert_count({
  label: 'POST nfl_games pre-2000 backup rows',
  expected: 1885,
  query: 'count(*) FROM nfl_games_preconform_pre2000_20260902'
})}${assert_count({
  label: 'POST player pre-2000 backup rows',
  expected: 1,
  query: 'count(*) FROM player_preconform_pre2000_20260902'
})}-- SCOPED TO PRE-2000, which is what this file is responsible for. An earlier
-- revision asserted zero residual across ALL seasons and the dry run failed it
-- at 672 -- the 668 nfl_games and 4 player rows increment D owns. That reading
-- was correct: a file must assert its own effect, not one that depends on a
-- sibling having been applied first, or it passes and fails on run ORDER
-- rather than on whether it worked.
${assert_count({
  label: 'POST residual non-conforming slots, before 2000',
  expected: 0,
  query: `count(*) FROM (
    SELECT 1 FROM nfl_games g WHERE g.season_year < 2000
      AND (${resolve('g.away_nfl_team', 'g.season_year')} <> g.away_nfl_team
        OR ${resolve('g.home_nfl_team', 'g.season_year')} <> g.home_nfl_team)
    UNION ALL
    SELECT 1 FROM player p WHERE p.nfl_draft_year < 2000
      AND ${resolve('p.draft_team', 'p.nfl_draft_year')} IS DISTINCT FROM p.draft_team
  ) residual`
})}${assert_count({
  label: 'POST nfl_games row count unchanged',
  expected: 15622,
  query: 'count(*) FROM nfl_games'
})}${assert_count({
  label: 'POST non-franchise slots still 40',
  expected: 40,
  query: `count(*) FROM (
    SELECT away_nfl_team AS t FROM nfl_games
    UNION ALL SELECT home_nfl_team FROM nfl_games
  ) s WHERE s.t IN ('AFC','NFC','IRV','RIC','SAN','CRT','INA')`
})}`

writeFileSync(
  'db/adhoc/2026-09-02-conform-nfl-team-abbreviations-to-current.sql',
  d
)
writeFileSync(
  'db/adhoc/2026-09-02-conform-pre-2000-nfl-team-abbreviations.sql',
  e
)
console.log('wrote both conform files')
