-- STATUS: APPLIED 2026-08-17 against league_production
-- Conform the glued app-key ids and compound shorthand to full words, and DROP
-- the orphaned users.vbaseline.
--
-- 31 audit findings: 30 renames plus one drop. These are the campaign's
-- WHOLE-NAME compound-shorthand findings -- they carry no `token` field in the
-- audit JSON, so the map deriver structurally cannot produce them (`srbwrte` and
-- `tddate` have no underscores to split) and the map is hand-authored with a
-- per-column target resolved from the schema and the code.
--
-- Four targets needed evidence beyond the name:
--   seasons.tddate is the TRADE DEADLINE, not a touchdown date (db/fixtures/league.mjs
--     sets it to regular_season_start + 12 weeks; app/core/selectors.js reads it as a
--     deadline), so it becomes trade_deadline_at -- the _at form the timestamptz
--     cluster wants, which avoids renaming it twice. It is already timestamptz, and
--     db/tools/timestamptz-conform-inventory.mjs carries the rename beside it.
--   trades_picks.pickid becomes draft_pick_id, NOT pick_id -- agreed with the
--     retire-uid-surrogate-key cluster, which renames the PARENT draft.uid and cannot
--     spell it pick_id beside draft.pick and draft.pick_string. Parent and child must
--     spell it identically or the decode step this campaign removes just relocates.
--   league_formats.srbwrte is the RBWRTE flex slot COUNT (roster.js builds the slot
--     from it) and sits among starter_slots_* siblings, so it takes the
--     position-enumerated form matching starter_slots_running_back_wide_receiver_flex.
--   league_formats.sqbrbwrte CANNOT take that form. The enumerated spelling is 67
--     bytes and Postgres truncates an identifier at 63 -- SILENTLY, as a NOTICE
--     rather than an error, so the DDL succeeds and leaves a column ending in a
--     trailing underscore that every swept consumer then fails to resolve. Caught in
--     rehearsal. It becomes starter_slots_superflex: `superflex` is the house term
--     for this QB-eligible flex slot (libs-server/keeptradecut-liquidity.mjs already
--     carries is_superflex) and the audit vocabulary accepts it.
--
-- users.vbaseline is DROPPED per the operator ruling (2026-08-17): 133 rows across
-- two values (125 default, 8 manual) and NO application code reads or writes it, so
-- it is orphaned preference state for a value-baseline feature that no longer exists.
-- It rides here rather than in a standalone apply because a drop opens the same
-- apply-to-commit window a rename does, and a second window for one dead column
-- buys nothing.
--
-- `uid` is deliberately UNTOUCHED. It is the row's OWN surrogate primary key on all
-- 17 tables carrying it, and it coexists with `userid` on five of these tables
-- meaning something different -- so conforming userid to user_id beside a retained
-- uid is correct rather than a collision (league 23f061633 corrected the ruler
-- comment that manufactured that question).
--
-- projections_history and projections_index are PARTITIONED; renaming on the parent
-- propagates to every child. league_formats_config_unique is a full-tuple UNIQUE
-- index and needs no rebuild -- Postgres rewrites an index's parsed definition on
-- RENAME COLUMN, verified in rehearsal.
--
-- No BEGIN/COMMIT: db-exec.sh runs the file as one transaction.
SET lock_timeout = '30s';
SET statement_timeout = 0;

ALTER TABLE league_formats RENAME COLUMN sqbrbwrte TO starter_slots_superflex;
ALTER TABLE league_formats RENAME COLUMN srbwrte TO starter_slots_running_back_wide_receiver_tight_end_flex;
ALTER TABLE league_user_careerlogs RENAME COLUMN userid TO user_id;
ALTER TABLE leagues RENAME COLUMN commishid TO commissioner_user_id;
ALTER TABLE placed_wagers RENAME COLUMN userid TO user_id;
ALTER TABLE poach_releases RENAME COLUMN poachid TO poach_id;
ALTER TABLE poaches RENAME COLUMN userid TO user_id;
ALTER TABLE projections_history RENAME COLUMN sourceid TO source_id;
ALTER TABLE projections_history RENAME COLUMN userid TO user_id;
ALTER TABLE projections_index RENAME COLUMN sourceid TO source_id;
ALTER TABLE projections_index RENAME COLUMN userid TO user_id;
ALTER TABLE props RENAME COLUMN sourceid TO source_id;
ALTER TABLE restricted_free_agency_bids RENAME COLUMN userid TO user_id;
ALTER TABLE ros_projections RENAME COLUMN sourceid TO source_id;
ALTER TABLE seasons RENAME COLUMN tddate TO trade_deadline_at;
ALTER TABLE trade_releases RENAME COLUMN tradeid TO trade_id;
ALTER TABLE trades RENAME COLUMN userid TO user_id;
ALTER TABLE trades_picks RENAME COLUMN pickid TO draft_pick_id;
ALTER TABLE trades_picks RENAME COLUMN tradeid TO trade_id;
ALTER TABLE trades_players RENAME COLUMN tradeid TO trade_id;
ALTER TABLE trades_transactions RENAME COLUMN tradeid TO trade_id;
ALTER TABLE trades_transactions RENAME COLUMN transactionid TO transaction_id;
ALTER TABLE transactions RENAME COLUMN userid TO user_id;
ALTER TABLE transactions RENAME COLUMN waiverid TO waiver_id;
ALTER TABLE users RENAME COLUMN lastvisit TO last_visit_at;
ALTER TABLE users_sources RENAME COLUMN sourceid TO source_id;
ALTER TABLE users_sources RENAME COLUMN userid TO user_id;
ALTER TABLE users_teams RENAME COLUMN userid TO user_id;
ALTER TABLE waiver_releases RENAME COLUMN waiverid TO waiver_id;
ALTER TABLE waivers RENAME COLUMN userid TO user_id;

-- Operator-ruled DROP (2026-08-17): orphaned, zero application consumers.
ALTER TABLE users DROP COLUMN vbaseline;

-- A rename does NOT reach into a PL/pgSQL function body: the body is stored as
-- TEXT, keeps compiling, is invisible to every code-tree sweep, and throws only
-- when something calls it. cmv_classify_league_format reads NEW.sqbrbwrte, so
-- without this replacement every league_formats INSERT fails with
-- `record "new" has no field "sqbrbwrte"` -- which the rehearsal measured as 132
-- suite failures, because db/fixtures/league.mjs writes league_formats for every
-- league-scoped spec. This is the SECOND time this same trigger has been the
-- unreachable half of a conform batch (the position-code batch hit it on
-- starter_slots_qb), which is the argument for checking pg_proc every time.
CREATE OR REPLACE FUNCTION public.cmv_classify_league_format() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  rec_val numeric;
BEGIN
  SELECT receptions INTO rec_val FROM league_scoring_formats WHERE id = NEW.scoring_format_id;
  NEW.format_category := cmv_derive_format_category(NEW.starter_slots_quarterback, NEW.starter_slots_superflex, rec_val);
  RETURN NEW;
END;
$$;

-- cmv_derive_format_category's second PARAMETER is also spelled `sqbrbwrte`, and
-- it is deliberately left alone: a parameter name is not a schema column, the
-- audit does not read it, the call above is positional, and the function's own
-- local is already named `superflex` -- which is the independent confirmation
-- that `starter_slots_superflex` is the right target for the column. Renaming it
-- would need a DROP and CREATE rather than a REPLACE, since Postgres refuses to
-- change an input parameter's name in place.
