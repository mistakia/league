-- league-app cluster, Wave 1 (user:task/league/redesign-league-database-schema.md).
-- Pure metadata ALTER RENAME COLUMN across the small, low-consumer-surface
-- league-app tables: team colors, the nfl_team dimension + season_year on the
-- two nfl_team_seasonlogs tables, and the reserved-word league_cutlist."order".
-- These tables have only periodic-batch writers (no continuous PM2 writer), so a
-- coordinated flip with no compat view is safe (fantasy-stat-vocab precedent).
--
-- APP-class, NOT CONTRACT: re-verified there is no nfl_team_seasonlogs_tm
-- data-view field id (tm is a key_columns dimension, not a selectable field), so
-- no user_data_views saved-view migration is required. league_nfl_team_seasonlogs
-- pts/rnk ARE data-view-exposed, but their saved-view field ids are already the
-- full words (league_nfl_team_seasonlogs_points / _rank) -- this rename resolves
-- the pre-existing physical/field-id mismatch rather than creating one, and the
-- saved id does not change, so again no user_data_views migration.
--
-- No FUNCTION/VIEW/materialized view references any of these tables (verified),
-- so no plpgsql body rewrite is needed. No index/constraint name embeds an old
-- token (the numeric-hash unique indexes auto-update their column refs on
-- rename), so this is pure column renames. Runs single-txn via yarn db:exec.

SET LOCAL statement_timeout = 0;

-- teams: color columns (pc is a CSS hex color, NOT pass-completions -- the audit
-- shorthand hint is a false positive for this table)
ALTER TABLE public.teams RENAME COLUMN pc TO primary_color;
ALTER TABLE public.teams RENAME COLUMN ac TO accent_color;

-- nfl_team_seasonlogs: the sole residual dimension rename after the fantasy-vocab
-- cutover conformed the 40 stat columns; season_year brings it to the redesign
-- standard. Pairs with league_nfl_team_seasonlogs below (route joins on both).
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN tm TO nfl_team;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN year TO season_year;

-- league_nfl_team_seasonlogs: dimension + the two exposed metrics. pts/rnk field
-- ids are already _points/_rank; renaming the physical columns aligns select_as
-- with the field id.
ALTER TABLE public.league_nfl_team_seasonlogs RENAME COLUMN tm TO nfl_team;
ALTER TABLE public.league_nfl_team_seasonlogs RENAME COLUMN pts TO points;
ALTER TABLE public.league_nfl_team_seasonlogs RENAME COLUMN rnk TO rank;
ALTER TABLE public.league_nfl_team_seasonlogs RENAME COLUMN year TO season_year;

-- league_cutlist: reserved-word + quoted column -> full word (sort priority of
-- player releases during roster moves).
ALTER TABLE public.league_cutlist RENAME COLUMN "order" TO sort_order;
