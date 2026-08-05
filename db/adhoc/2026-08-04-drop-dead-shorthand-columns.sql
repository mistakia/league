-- STATUS: APPLIED 2026-08-05 against league_production
--
-- Shorthand conformance: drop nine dead columns
--
-- Retires 9 of the 234 shorthand violations reported by
-- db/adhoc/audit-schema-conformance.mjs at ruler league 74b1366cd. These are
-- dropped rather than renamed because each is dead: naming them properly would
-- only preserve debt.
--
-- Each claim below was re-verified against production on 2026-08-04,
-- independently of db/adhoc/shorthand-rename-map.json.
--
-- users.qbb / rbb / wrb / teb -- per-position manual starter-value baselines.
--   Feature added 2020-07-21 (9ac198280), removed 2022-07-15 (2d250a67c); the
--   DROP was never run against the live database, so the columns outlived the
--   code. VERIFIED: zero live-code references tree-wide (positive control:
--   invite_code matches 6 files); 11 of 133 rows non-null, only 10 meaningful;
--   stored values are player ids in a retired format that no longer resolve.
--   NOTE: api/routes/me.mjs:175 issues a bare db('users').where(...) with no
--   .select(), so these four columns are currently serialised into the /me
--   response. Nothing reads them, but the response shape changes.
--
-- seasons.ext1 / ext2 / ext3 / ext4 -- speculative per-league extension pricing
--   that was never implemented. The live formula is linear and ignores them:
--   libs-shared/get-extension-amount.mjs:52 returns value + (extensions + 1) * 5,
--   a +5/+10/+15/+20 ladder that never matched the 5/10/20/35 defaults.
--   VERIFIED: all 122 season rows carry one identical default combination, zero
--   non-default; the columns are absent from the settings allowlist in
--   api/routes/leagues/league-settings.mjs, so no update path can set them.
--
--   PREREQUISITE -- do NOT apply this file before these edits land. Unlike the
--   users columns, ext1-4 have a live WRITE path: libs-server/create-league.mjs:75-78
--   inserts all four into seasons on every league creation. Dropping the columns
--   first makes league creation throw on an unknown column. Remove the fields
--   from libs-server/create-league.mjs:75-78, from the league record in
--   app/core/leagues/league.js, and from the fixture in test/roster.spec.mjs:605-608
--   before applying.
--
-- nfl_plays_current_week.box -- vestigial charting column, superseded by
--   box_defenders_charted on nfl_plays. VERIFIED: 0 of 5,969 rows non-null, and
--   scripts/import-charted-plays-from-csv.mjs writes box_defenders_charted from
--   the CSV's box field into nfl_plays only (line 124), never into
--   nfl_plays_current_week. Note that box_defenders_charted does NOT exist on
--   nfl_plays_current_week -- it lives on nfl_plays and its 27 partitions --
--   so this drop leaves that table with box_defenders and boxdb, no successor.
--
-- ORDERING: apply only AFTER the boolean-prefix sweep
-- (db/adhoc/2026-08-04-conform-boolean-prefix-*.sql) has landed its DDL and
-- committed its consumer sweep.
--
-- Source of truth for the dispositions:
--   db/adhoc/shorthand-rename-map.json

-- users (4)
ALTER TABLE public.users DROP COLUMN qbb;
ALTER TABLE public.users DROP COLUMN rbb;
ALTER TABLE public.users DROP COLUMN wrb;
ALTER TABLE public.users DROP COLUMN teb;

-- seasons (4)
ALTER TABLE public.seasons DROP COLUMN ext1;
ALTER TABLE public.seasons DROP COLUMN ext2;
ALTER TABLE public.seasons DROP COLUMN ext3;
ALTER TABLE public.seasons DROP COLUMN ext4;

-- nfl_plays_current_week (1)
ALTER TABLE public.nfl_plays_current_week DROP COLUMN box;
