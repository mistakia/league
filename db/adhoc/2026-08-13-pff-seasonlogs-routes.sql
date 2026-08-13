-- STATUS: APPLIED 2026-08-13 against league_production
--
-- Split the PFF receiving-snaps conflation into two honest columns.
--
-- `pff_player_seasonlogs.receiving_snaps` never held receiving snaps. The PFF
-- grades endpoint's `receiving_snaps` field is what pff.com displays under
-- "PASS" -- it counts the pass plays the player was on the field for. Verified
-- at scale against the premium archive: `route_rate = 100 * routes /
-- pass_plays` holds for 506/506 records in the 2025 `receiving_summary` facet,
-- and for Luther Burden III the archive's `pass_plays` is 321, which is exactly
-- the stored `receiving_snaps`. The true receiving-snap count is the archive's
-- `routes` (307 for Burden).
--
-- So the stored value is correct data under a wrong name: rename rather than
-- drop, and add `routes` alongside for the value that was missing.
--
-- The new name is `pass_plays`, matching PFF's own field name for this value in
-- receiving_summary, so schema and vendor payload share one word for one thing.
-- Deliberately NOT `pass_play_snaps`: this table already carries `pass_snaps`
-- (QB-only -- avg 285 for QB against 1 for WR), and two columns differing by one
-- word that both read as "snaps on passing downs" is the exact shape of the
-- conflation this migration exists to remove. `plays` against `snaps` is the
-- real distinction.
--
-- `pass_snaps` itself cannot absorb the rename: it is QB-only and already has
-- its own data-view field reading it.
--
-- Spelling is the bare `routes`, not `routes_run`: four tables already carry a
-- bare `routes` column (player_receiving_gamelogs, pff_player_facet_gamelogs,
-- pff_player_facet_seasonlogs, nfl_team_seasonlogs) against two spelling it
-- `routes_run`, and the data-view vocabulary exposes only `player_routes`.
--
-- The 14,528 `pff_player_seasonlogs_changelog` rows keyed
-- `column_name='receiving_snaps'` are deliberately left stale. The table
-- already holds 162k rows keyed to `status`, a column that no longer exists;
-- the changelog is a record of what was written at the time.

ALTER TABLE public.pff_player_seasonlogs
    RENAME COLUMN receiving_snaps TO pass_plays;

ALTER TABLE public.pff_player_seasonlogs
    ADD COLUMN routes integer;
