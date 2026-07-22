-- Clean-end-state follow-up to 2026-07-22-changelog-unify-small.sql.
--
-- The three smaller *_changelog tables were unified onto the canonical shape via
-- in-place ALTER, which cannot reorder columns: the renamed columns kept their
-- original ordinal positions and the added `source`/`reason`/`id` were appended,
-- leaving `id` LAST and `changed_at` before `source`/`reason`. player_changelog
-- (built by create-swap) already carries the canonical order:
--
--   id, <entity key(s)>, column_name, previous_value, new_value,
--   source, reason, changed_at
--
-- This rebuilds the three small tables in that exact order so all four changelog
-- tables are physically uniform (the lane's stated invariant: one shape differing
-- only by entity key). Column order is name-addressed everywhere, so this is a
-- pure physical reshape with zero code impact; done as create-swap because
-- Postgres cannot reorder columns via ALTER.
--
-- Each table's surrogate `id` values are PRESERVED exactly (OVERRIDING SYSTEM
-- VALUE) — these are audit rows and the id is a stable surrogate — and the
-- identity sequence is advanced past max(id) so future inserts continue cleanly.
--
-- ORDERING NOTE: index/constraint/sequence names are unique per SCHEMA, not per
-- table, and these tables' PK/natural-key/sequence already carry the canonical
-- names (from the first cutover's in-place ALTER). So the old table is DROPPED
-- (after the parity guard) to free those names BEFORE the new table's objects are
-- renamed into them.
--
-- yarn db:exec wraps the whole file in one transaction; each table swaps under
-- ACCESS EXCLUSIVE with a row-count parity guard before the old table is dropped.
-- The tables are small and their writers (play/games month-gated to in-season;
-- pff on-demand) are idle in the offseason window.

-- Prod carries a 40s default statement_timeout; the play_changelog rebuild
-- (~3.9M rows + unique-index build) runs longer. Lift it transaction-locally.
SET LOCAL statement_timeout = '60min';

-- ============================================================================
-- play_changelog (~3.9M): entity key (esbid, play_id); natural-key unique index
-- (esbid, play_id, column_name, changed_at) rebuilt for record_changelog's
-- conflict-ignore.
-- ============================================================================
CREATE TABLE public.play_changelog_new (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  esbid bigint NOT NULL,
  play_id bigint NOT NULL,
  column_name text NOT NULL,
  previous_value text,
  new_value text,
  source text NOT NULL,
  reason text,
  changed_at timestamptz NOT NULL
);

LOCK TABLE public.play_changelog IN ACCESS EXCLUSIVE MODE;

INSERT INTO public.play_changelog_new
  (id, esbid, play_id, column_name, previous_value, new_value, source, reason, changed_at)
OVERRIDING SYSTEM VALUE
SELECT id, esbid, play_id, column_name, previous_value, new_value, source, reason, changed_at
FROM public.play_changelog;

DO $$
DECLARE old_ct bigint; new_ct bigint;
BEGIN
  SELECT count(*) INTO old_ct FROM public.play_changelog;
  SELECT count(*) INTO new_ct FROM public.play_changelog_new;
  IF old_ct <> new_ct THEN
    RAISE EXCEPTION 'play_changelog row-count mismatch: old=% new=%', old_ct, new_ct;
  END IF;
END $$;

ALTER TABLE public.play_changelog RENAME TO play_changelog_old;
ALTER TABLE public.play_changelog_new RENAME TO play_changelog;
DROP TABLE public.play_changelog_old;

ALTER TABLE public.play_changelog RENAME CONSTRAINT play_changelog_new_pkey TO play_changelog_pkey;
ALTER SEQUENCE public.play_changelog_new_id_seq RENAME TO play_changelog_id_seq;
SELECT setval('public.play_changelog_id_seq', (SELECT max(id) FROM public.play_changelog));

CREATE UNIQUE INDEX play_changelog_natural_key
  ON public.play_changelog (esbid, play_id, column_name, changed_at);
GRANT SELECT ON TABLE public.play_changelog TO league_reader;

-- ============================================================================
-- nfl_games_changelog (~12k): entity key (esbid); no natural key.
-- ============================================================================
CREATE TABLE public.nfl_games_changelog_new (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  esbid character varying(36) NOT NULL,
  column_name text NOT NULL,
  previous_value text,
  new_value text,
  source text NOT NULL,
  reason text,
  changed_at timestamptz NOT NULL
);

LOCK TABLE public.nfl_games_changelog IN ACCESS EXCLUSIVE MODE;

INSERT INTO public.nfl_games_changelog_new
  (id, esbid, column_name, previous_value, new_value, source, reason, changed_at)
OVERRIDING SYSTEM VALUE
SELECT id, esbid, column_name, previous_value, new_value, source, reason, changed_at
FROM public.nfl_games_changelog;

DO $$
DECLARE old_ct bigint; new_ct bigint;
BEGIN
  SELECT count(*) INTO old_ct FROM public.nfl_games_changelog;
  SELECT count(*) INTO new_ct FROM public.nfl_games_changelog_new;
  IF old_ct <> new_ct THEN
    RAISE EXCEPTION 'nfl_games_changelog row-count mismatch: old=% new=%', old_ct, new_ct;
  END IF;
END $$;

ALTER TABLE public.nfl_games_changelog RENAME TO nfl_games_changelog_old;
ALTER TABLE public.nfl_games_changelog_new RENAME TO nfl_games_changelog;
DROP TABLE public.nfl_games_changelog_old;

ALTER TABLE public.nfl_games_changelog RENAME CONSTRAINT nfl_games_changelog_new_pkey TO nfl_games_changelog_pkey;
ALTER SEQUENCE public.nfl_games_changelog_new_id_seq RENAME TO nfl_games_changelog_id_seq;
SELECT setval('public.nfl_games_changelog_id_seq', (SELECT max(id) FROM public.nfl_games_changelog));

GRANT SELECT ON TABLE public.nfl_games_changelog TO league_reader;

-- ============================================================================
-- pff_player_seasonlogs_changelog (~579k): entity key (pid, season_year);
-- no natural key.
-- ============================================================================
CREATE TABLE public.pff_player_seasonlogs_changelog_new (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pid character varying(25) NOT NULL,
  season_year smallint NOT NULL,
  column_name text NOT NULL,
  previous_value text,
  new_value text,
  source text NOT NULL,
  reason text,
  changed_at timestamptz NOT NULL
);

LOCK TABLE public.pff_player_seasonlogs_changelog IN ACCESS EXCLUSIVE MODE;

INSERT INTO public.pff_player_seasonlogs_changelog_new
  (id, pid, season_year, column_name, previous_value, new_value, source, reason, changed_at)
OVERRIDING SYSTEM VALUE
SELECT id, pid, season_year, column_name, previous_value, new_value, source, reason, changed_at
FROM public.pff_player_seasonlogs_changelog;

DO $$
DECLARE old_ct bigint; new_ct bigint;
BEGIN
  SELECT count(*) INTO old_ct FROM public.pff_player_seasonlogs_changelog;
  SELECT count(*) INTO new_ct FROM public.pff_player_seasonlogs_changelog_new;
  IF old_ct <> new_ct THEN
    RAISE EXCEPTION 'pff_player_seasonlogs_changelog row-count mismatch: old=% new=%', old_ct, new_ct;
  END IF;
END $$;

ALTER TABLE public.pff_player_seasonlogs_changelog RENAME TO pff_player_seasonlogs_changelog_old;
ALTER TABLE public.pff_player_seasonlogs_changelog_new RENAME TO pff_player_seasonlogs_changelog;
DROP TABLE public.pff_player_seasonlogs_changelog_old;

ALTER TABLE public.pff_player_seasonlogs_changelog RENAME CONSTRAINT pff_player_seasonlogs_changelog_new_pkey TO pff_player_seasonlogs_changelog_pkey;
ALTER SEQUENCE public.pff_player_seasonlogs_changelog_new_id_seq RENAME TO pff_player_seasonlogs_changelog_id_seq;
SELECT setval('public.pff_player_seasonlogs_changelog_id_seq', (SELECT max(id) FROM public.pff_player_seasonlogs_changelog));

GRANT SELECT ON TABLE public.pff_player_seasonlogs_changelog TO league_reader;
