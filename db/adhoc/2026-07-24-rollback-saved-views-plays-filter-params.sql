-- ROLLBACK for the saved-view plays filter-param migration
-- (inverse of db/adhoc/2026-07-24-migrate-saved-views-plays-filter-params.sql).
--
-- ONLY VALID BEFORE THE FRONTEND DEPLOY IS LIVE TO USERS. Verified read-only on prod
-- immediately before the apply: 0 rows contained "offense_nfl_team": / "defense_nfl_team":
-- / "possession_nfl_team": as saved-view filter-param keys, so every occurrence this
-- reverses is one the forward migration created. Once the deployed UI starts saving views
-- under the new names that property is gone -- a blind inverse would corrupt genuinely-new
-- views -- and forward-fix is the only correct option.
--
-- Re-check before running:
--   SELECT count(*) FROM public.user_data_views
--   WHERE table_state::text ~ '"(offense_nfl_team|defense_nfl_team|possession_nfl_team)":';
-- If that count exceeds the 12 rows the forward migration touched, STOP.
--
-- Unanchored to match the forward file (two serializers write table_state; some rows put a
-- space before the key).
--
-- yarn db:exec db/adhoc/2026-07-24-rollback-saved-views-plays-filter-params.sql

BEGIN;

UPDATE public.user_data_views
SET table_state = replace(replace(replace(table_state::text,
      '"possession_nfl_team":', '"pos_team":'),
      '"offense_nfl_team":',    '"off":'),
      '"defense_nfl_team":',    '"def":')::json
WHERE table_state::text ~ '"(offense_nfl_team|defense_nfl_team|possession_nfl_team)":';

COMMIT;
