-- 2026-07-22: Conform-only column renames for four identity-crosswalk cluster
-- dimension/derived tables (schema-redesign Item 4). Pure metadata renames, no
-- type changes: brings names to the schema-standard (season_year not bare year,
-- {system}_player_id external ids, is_ boolean prefix, full-word position/date).
--
-- Type-sensitive retypes are DEFERRED to their own coordinated changes (same class
-- as the player.dob varchar->date retype): players_status."timestamp" (integer
-- epoch, also a reserved word) and the integer-epoch audit columns stay as-is for
-- now. player_aliases already conforms (pid/formatted_alias/source) -- no DDL.
--
-- Consumers are script/simulation-only per a full surface sweep; the sole
-- continuous-app reader (is-player-locked.mjs) reads players_status via SELECT *
-- and only touches roster_status/"timestamp" (neither renamed), so no compat view
-- is needed -- the repointed code deploys alongside this rename.
--
-- (yarn db:exec wraps the whole file in one transaction with ON_ERROR_STOP=1, so
-- no explicit BEGIN/COMMIT is needed.)

-- player_archetypes: derived single-archetype-per-season attribute. The position
-- column mirrors the player dimension's primary_position (avoids the quoted
-- `position` keyword and keeps one name per concept).
ALTER TABLE public.player_archetypes RENAME COLUMN pos TO primary_position;
ALTER TABLE public.player_archetypes RENAME COLUMN year TO season_year;

-- player_pair_correlations: derived pairwise correlation analytics.
ALTER TABLE public.player_pair_correlations RENAME COLUMN year TO season_year;
ALTER TABLE public.player_pair_correlations RENAME COLUMN team_a TO nfl_team_a;
ALTER TABLE public.player_pair_correlations RENAME COLUMN team_b TO nfl_team_b;
ALTER INDEX public.idx_player_pair_correlations_year_pid_a
  RENAME TO idx_player_pair_correlations_season_year_pid_a;
ALTER INDEX public.idx_player_pair_correlations_year_pid_b
  RENAME TO idx_player_pair_correlations_season_year_pid_b;

-- players_status: sleeper/mfl-sourced status feed.
ALTER TABLE public.players_status RENAME COLUMN mfl_id TO mfl_player_id;
ALTER TABLE public.players_status RENAME COLUMN sleeper_id TO sleeper_player_id;
ALTER TABLE public.players_status RENAME COLUMN active TO is_active;

-- nfl_coaches: coach dimension (dob is already type date -- pure name rename).
ALTER TABLE public.nfl_coaches RENAME COLUMN dob TO date_of_birth;
