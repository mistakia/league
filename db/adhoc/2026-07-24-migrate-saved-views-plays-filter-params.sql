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
-- "from"/"to" key. Verified on prod rather than assumed: for every row the text
-- occurrence count of each `"key":` equals a recursive jsonb key walk of the same
-- document (0 rows differ), so no match lands inside a string value.
--
-- The WHERE predicate is deliberately NOT anchored to [,{]. Two serializers write
-- table_state and 63 of 184 rows put a space before the key, so an anchored pattern
-- skipped view a2176ac0-b629-431b-9001-5317dd324cbc ("WR Targets over the middle",
-- `, "off": null`) -- 12 rows carry these keys, not 11. Its values are null, so nothing
-- breaks today (apply_play_by_play_column_params_to_query iterates the registry and skips
-- null), but a space-separated row with a NON-null value would silently lose its filter,
-- which is the exact failure this migration exists to prevent.
--
-- Idempotent: no replacement output contains an old key as a substring, and the three
-- replace() calls are order-independent. Lossless: table_state is `json`, not `jsonb`,
-- so ::text returns the stored bytes verbatim and text::json only validates -- no key
-- reordering, whitespace normalization, or numeric reformatting.
--
-- Run in the same cutover as 2026-07-24-conform-nfl-plays-snaps.sql.
-- yarn db:exec db/adhoc/2026-07-24-migrate-saved-views-plays-filter-params.sql

BEGIN;

UPDATE public.user_data_views
SET table_state = replace(replace(replace(table_state::text,
      '"pos_team":', '"possession_nfl_team":'),
      '"off":',      '"offense_nfl_team":'),
      '"def":',      '"defense_nfl_team":')::json
WHERE table_state::text ~ '"(off|def|pos_team)":';

COMMIT;
