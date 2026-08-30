-- STATUS: APPLIED 2026-08-30 against league_production
--
-- Create nfl_player_play_charting: the per-player-per-snap charting grain from
-- the vendor's players/by-play endpoint. Alignment, route, coverage
-- responsibility, gap assignment, technique and pressure, per player per snap --
-- a grain we hold from no other source.
--
-- Shape measured live 2026-08-30 against 2025 REG week 1, esbid 2025090400,
-- Dallas: 1,618 rows, 47 distinct players in 47 contiguous blocks, 49 response
-- keys of which one is __typename and three are nested objects, leaving 45
-- scalars. All 45 are here.
--
-- THE KEY, and it is the part most likely to be misread.
--
-- There is NO natural key. Those 1,618 rows collapse to 796 distinct content
-- values: an offensive lineman with the same alignment, role, no route and no
-- statistics produces a byte-identical row on every snap. Rows are grouped by
-- PLAYER, one contiguous block each, not interleaved in play order.
--
-- So vendor_row_index is a SURROGATE ROW NUMBER carrying the vendor's return
-- order, and it is the sole carrier of row identity. It does not identify a
-- snap. It cannot be joined to a play. It must never be compared across imports
-- or exposed to a consumer as though it referenced anything. It exists so that
-- delete-then-insert per (esbid, nfl_team) is idempotent, which is the only
-- property required, because nothing joins on it.
--
-- The consequence worth planning around: the import cannot be validated or
-- de-duplicated by content. A truncated or partially fetched response is
-- undetectable by inspecting rows, so the importer's oracle compares the
-- inserted row count against the count the vendor returned for that request.
--
-- Keyed on nfl_team rather than the vendor's team UUID. The team map in
-- charting-data/team-mapping.mjs is static, complete for all 32 teams and
-- verified, and the importer supplies the vendor id from its own inverse map --
-- so the abbreviation is always known, and it is what every consumer joins on.
-- sumer_player_id is a different case and IS stored on every row: player
-- resolution is fuzzy (the direct id join misses 18 percent of by-play players,
-- and at least one stored id is outright wrong), so the vendor id is the durable
-- identity and pid is a nullable derived convenience that can be backfilled as
-- matching improves. A row is never dropped for an unresolved player.
--
-- Naming: `quarterback` not `qb` -- position abbreviations are flagged by
-- db/tools/schema-token-vocabulary.mjs, while `epa` is ratified. is_ prefixes
-- follow the boolean-prefix conform. receiving_receptions, receiving_epa and
-- receiving_yards_after_catch match nfl_matchup_stats, which holds the same
-- facts at season grain.
--
-- defense_sacks is numeric(3,1) because the vendor serialises it as the STRING
-- '1.0' -- half-sacks are real and an integer column would silently truncate.

SET lock_timeout = '30s';
SET statement_timeout = 0;

CREATE TABLE public.nfl_player_play_charting (
  esbid integer NOT NULL,
  nfl_team character varying(4) NOT NULL,
  vendor_row_index smallint NOT NULL,

  sumer_player_id character varying(36) NOT NULL,
  pid character varying(25),
  jersey_number smallint,

  alignment character varying(8),
  alignment_side character varying(8),
  role character varying(16),
  defender_technique character varying(8),
  is_box_alignment boolean,

  route character varying(16),
  route_release character varying(16),
  route_break_depth numeric(5,2),

  coverage_responsibility character varying(24),
  coverage_responsibility_side character varying(8),
  is_primary_coverage boolean,

  gap_assignment character varying(16),
  gap_assignment_side character varying(8),

  press_type character varying(16),
  is_press boolean,
  is_pressure boolean,
  is_pressure_allowed boolean,
  is_hurry boolean,
  is_hurry_allowed boolean,
  is_sack_allowed boolean,
  is_hit boolean,
  is_quarterback_hitter boolean,

  is_shift boolean,
  is_quarterback_scramble boolean,
  is_quarterback_designed_run boolean,
  is_first_contact boolean,
  is_stop boolean,
  is_tackle_missed boolean,
  is_pass_breakup boolean,
  is_reception_allowed boolean,

  passing_depth_of_target smallint,
  passing_epa numeric(16,12),
  receiving_depth_of_target smallint,
  receiving_receptions smallint,
  receiving_yards_after_catch smallint,
  receiving_epa numeric(16,12),
  rushing_epa numeric(16,12),
  yards_after_contact smallint,

  defense_solo_tackles smallint,
  defense_assisted_tackles smallint,
  defense_tackles_for_loss smallint,
  defense_sacks numeric(3,1),

  CONSTRAINT nfl_player_play_charting_pkey
    PRIMARY KEY (esbid, nfl_team, vendor_row_index)
);

-- The two access paths the grain exists for: everything a player did across
-- games, and everything that happened in one game.
CREATE INDEX idx_nfl_player_play_charting_pid
  ON public.nfl_player_play_charting (pid);
CREATE INDEX idx_nfl_player_play_charting_sumer_player_id
  ON public.nfl_player_play_charting (sumer_player_id);

-- Enumerated by hand, not inherited: league_data_view_reader's GRANT SELECT
-- list is per-table rather than a schema-wide default, so a table created
-- afterwards gets league_reader (which IS a default) and nothing else, and no
-- gate reports the omission -- it surfaces as a permission error at query time,
-- in the cutover rather than in the migration.
GRANT SELECT ON TABLE public.nfl_player_play_charting TO league_data_view_reader;
