-- STATUS: APPLIED 2026-08-30 against league_production
-- Add nfl_games.finalized_plays_updated_at, the per-game finalization watermark.
--
-- WHAT IT HOLDS, and the distinction the name is trying to carry: this is a
-- WATERMARK over nfl_plays.updated, not a completion time. finalize_game reads
-- max(nfl_plays.updated) for the esbid BEFORE its first step and stamps that
-- value here on success. Finalization averages 71 seconds, so stamping now() at
-- the end would swallow any play corrected DURING the run and that game would
-- never re-finalize again -- a silent, permanent loss of a correction.
--
-- Nullable with no default, and null means never finalized. A backfill would be
-- the wrong move: no existing row has a truthful watermark to carry, and
-- stamping one would assert coverage the pipeline never performed. Every
-- completed game therefore finalizes once more after this lands, and settles.
--
-- WHY A NEW COLUMN rather than reusing the jobs table: `jobs` is
-- (job_id, type, is_successful, reason, run_at) with no esbid, and report_job
-- writes a flat audit line, so there is nowhere to record WHAT a finalization
-- covered. nfl_games carries a unique index on esbid (idx_24707_esbid), which
-- is what makes the single-row marker write well-defined.
--
-- Cheap: adding a nullable column with no default is a catalog-only change in
-- Postgres 11+, so this does not rewrite the table.
--
-- Ships with libs-server/finalize-game.mjs (the guard that reads and writes it)
-- and the schema dump, per the repo rule that DDL, the export and the dependent
-- code land in one commit.

alter table nfl_games add column finalized_plays_updated_at timestamptz;

comment on column nfl_games.finalized_plays_updated_at is
  'Watermark over nfl_plays.updated covered by the last successful finalization of this game. Read before finalization begins, written only on full success. Null means never finalized.';
