-- Migrate saved data-view filter params for the nfl-plays-snaps rename (LOCKSTEP,
-- operator decision 2, 2026-07-24). The data-view filter param-ids off/def/pos_team
-- (keys in libs-shared/nfl-plays-column-params.mjs) rename to their new column names,
-- so the params keys persisted in user_data_views.table_state must rename in lockstep or
-- those saved views silently lose the filter.
--
-- Only off/def/pos_team are actually persisted as filter-param keys (int/to/fuml are
-- registry keys but no saved view uses them; user_plays_views is empty). The `"key":`
-- form is unambiguous in JSON (a string VALUE "off" is followed by a delimiter, never a
-- colon, so `"off":` matches only the key), and no saved view uses a colliding "to"/date
-- "from"/"to" key. Validated read-only on prod: 11 rows affected, all re-parse as valid
-- json, 0 old keys remain.
--
-- Run in the same cutover as 2026-07-24-conform-nfl-plays-snaps.sql.
-- yarn db:exec db/adhoc/2026-07-24-migrate-saved-views-plays-filter-params.sql

BEGIN;

UPDATE public.user_data_views
SET table_state = replace(replace(replace(table_state::text,
      '"pos_team":', '"possession_nfl_team":'),
      '"off":',      '"offense_nfl_team":'),
      '"def":',      '"defense_nfl_team":')::json
WHERE table_state::text ~ '[,{]"(off|def|pos_team)":';

COMMIT;
