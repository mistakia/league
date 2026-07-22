-- Unify the three smaller *_changelog tables onto the canonical changelog
-- shape (schema-standards §"Canonical layer"): one uniform shape differing
-- only by entity key(s):
--
--   id bigint identity PK, <entity key(s)>, column_name text NOT NULL,
--   previous_value text, new_value text, source text NOT NULL, reason text,
--   changed_at timestamptz NOT NULL
--
-- This file covers play_changelog (3.9M), nfl_games_changelog (12k), and
-- pff_player_seasonlogs_changelog (579k) — small enough for in-place ALTER.
-- player_changelog (68.6M) is a separate gated create-swap file.
--
-- Existing rows carry no source (the column is new here); they are backfilled
-- with the honest sentinel 'historical_backfill' — per-row provenance cannot
-- be reconstructed retroactively. Go-forward writes carry the real source.

-- ============================================================================
-- play_changelog: esbid, "playId" -> play_id; prop -> column_name;
-- prev/new -> previous_value/new_value; "timestamp"(int) -> changed_at(tstz)
-- ============================================================================
ALTER TABLE public.play_changelog RENAME COLUMN prop TO column_name;
ALTER TABLE public.play_changelog RENAME COLUMN prev TO previous_value;
ALTER TABLE public.play_changelog RENAME COLUMN new TO new_value;
ALTER TABLE public.play_changelog RENAME COLUMN "playId" TO play_id;

ALTER TABLE public.play_changelog
  ALTER COLUMN column_name TYPE text,
  ALTER COLUMN previous_value TYPE text,
  ALTER COLUMN previous_value DROP NOT NULL,
  ALTER COLUMN new_value TYPE text,
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp"),
  ADD COLUMN source text,
  ADD COLUMN reason text,
  ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY;

ALTER TABLE public.play_changelog RENAME COLUMN "timestamp" TO changed_at;

UPDATE public.play_changelog SET source = 'historical_backfill' WHERE source IS NULL;
ALTER TABLE public.play_changelog ALTER COLUMN source SET NOT NULL;

-- Rebuild the natural-key unique index under the renamed columns.
DROP INDEX IF EXISTS public.idx_24793_play;
CREATE UNIQUE INDEX play_changelog_natural_key
  ON public.play_changelog (esbid, play_id, column_name, changed_at);

-- ============================================================================
-- nfl_games_changelog: column_name already named; widen to text.
-- prev/new -> previous_value/new_value; "timestamp"(int) -> changed_at(tstz)
-- ============================================================================
ALTER TABLE public.nfl_games_changelog RENAME COLUMN prev TO previous_value;
ALTER TABLE public.nfl_games_changelog RENAME COLUMN new TO new_value;

ALTER TABLE public.nfl_games_changelog
  ALTER COLUMN column_name TYPE text,
  ALTER COLUMN previous_value TYPE text,
  ALTER COLUMN new_value TYPE text,
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp"),
  ADD COLUMN source text,
  ADD COLUMN reason text,
  ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY;

ALTER TABLE public.nfl_games_changelog RENAME COLUMN "timestamp" TO changed_at;

UPDATE public.nfl_games_changelog SET source = 'historical_backfill' WHERE source IS NULL;
ALTER TABLE public.nfl_games_changelog ALTER COLUMN source SET NOT NULL;

-- ============================================================================
-- pff_player_seasonlogs_changelog: year -> season_year; prop -> column_name;
-- prev/new -> previous_value/new_value; "timestamp"(int) -> changed_at(tstz);
-- replace the uid serial surrogate with the canonical id identity.
-- ============================================================================
ALTER TABLE public.pff_player_seasonlogs_changelog RENAME COLUMN year TO season_year;
ALTER TABLE public.pff_player_seasonlogs_changelog RENAME COLUMN prop TO column_name;
ALTER TABLE public.pff_player_seasonlogs_changelog RENAME COLUMN prev TO previous_value;
ALTER TABLE public.pff_player_seasonlogs_changelog RENAME COLUMN new TO new_value;

ALTER TABLE public.pff_player_seasonlogs_changelog
  DROP CONSTRAINT IF EXISTS pff_player_seasonlogs_changelog_pkey;
ALTER TABLE public.pff_player_seasonlogs_changelog DROP COLUMN uid;
-- The uid sequence is not owned by the column in prod, so DROP COLUMN does not
-- cascade to it; drop it explicitly (IF EXISTS covers an owned-seq variant that
-- would already be gone).
DROP SEQUENCE IF EXISTS public.pff_player_seasonlogs_changelog_uid_seq;

ALTER TABLE public.pff_player_seasonlogs_changelog
  ALTER COLUMN column_name TYPE text,
  ALTER COLUMN previous_value TYPE text,
  ALTER COLUMN previous_value DROP NOT NULL,
  ALTER COLUMN new_value TYPE text,
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp"),
  ADD COLUMN source text,
  ADD COLUMN reason text,
  ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY;

ALTER TABLE public.pff_player_seasonlogs_changelog RENAME COLUMN "timestamp" TO changed_at;

UPDATE public.pff_player_seasonlogs_changelog SET source = 'historical_backfill' WHERE source IS NULL;
ALTER TABLE public.pff_player_seasonlogs_changelog ALTER COLUMN source SET NOT NULL;
