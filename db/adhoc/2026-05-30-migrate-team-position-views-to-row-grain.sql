-- Migrate the 25 user_data_views rows that used the legacy team-grain workaround
-- of `where player_position IN ['TEAM']` to the canonical dual-grain shape
-- `row_grain: ['team']`.
--
-- Background: under the dual-grain architecture (see
-- `text/league/data-views/source-bridge-architecture.md`), the canonical way
-- to get team-grain output is `row_grain: ['team']` plus team-grain prefix
-- columns. The player_position filter is a vestige -- the position-filter UI
-- (`app/core/data-views-fields/player-table-fields.js`) no longer exposes
-- TEAM, and `player.pos` has 0 TEAM rows, so the affected saved views were
-- returning empty result sets.
--
-- For all 25 affected rows:
--   * Set row_grain = ['team'].
--   * Set prefix_columns = ['team_code', 'team_name'] (every affected view's
--     existing prefix_columns was a subset of the standard player set
--     [player_name, player_nfl_teams, player_position, player_league_roster_status]
--     -- no non-player prefixes to preserve).
--   * Filter the where array to drop entries that are no longer meaningful
--     under team grain: the player_position TEAM filter itself, plus the lone
--     `player_nfl_teams != INA` entry on view b75a814f-4e6b-4ae7-8d77-85dce7ed8965
--     ("Team Offensive Situation (11/8/24)") which is a player-grain column
--     and cannot apply when the row identity is a team. No other view had
--     additional where entries (verified pre-migration: 24 of 25 have
--     n_where=1, and the 25th's second entry was the INA filter just
--     described).
--   * Sorts are preserved untouched -- every sort entry already references a
--     team-grain column id (team_*) or the array is empty (verified
--     pre-migration).
--
-- Idempotency: the WHERE clause matches only rows that still contain a
-- player_position TEAM filter, so re-running this script on an
-- already-migrated database is a no-op.

BEGIN;

UPDATE user_data_views
SET table_state = (
  (table_state::jsonb)
  || jsonb_build_object(
       'row_grain', jsonb_build_array('team'),
       'prefix_columns', jsonb_build_array('team_code', 'team_name'),
       'where', COALESCE(
         (
           SELECT jsonb_agg(w)
             FROM jsonb_array_elements((table_state::jsonb)->'where') w
            WHERE NOT (
                    (w->>'column_id' = 'player_position' AND (w->'value') ? 'TEAM')
                    OR w->>'column_id' = 'player_nfl_teams'
                  )
         ),
         '[]'::jsonb
       )
     )
)::json
WHERE table_state::text ~ '"player_position".*"TEAM"';

-- Verify the expected 25-row impact before committing. If the assertion
-- fails (mid-flight schema drift, partial prior migration, etc.) the
-- transaction aborts and nothing is changed.
DO $$
DECLARE
  remaining int;
BEGIN
  SELECT count(*) INTO remaining
    FROM user_data_views
   WHERE table_state::text ~ '"player_position".*"TEAM"';
  IF remaining <> 0 THEN
    RAISE EXCEPTION 'expected 0 remaining player_position TEAM views after migration, got %', remaining;
  END IF;
END$$;

COMMIT;
