-- STATUS: APPLIED 2026-08-14 against league_production
--
-- Give pff_player_seasonlogs a season-type dimension.
--
-- Every existing row holds PFF's combined regular-season-plus-postseason value:
-- the vendor's season-level grades endpoint ignores a seas_type parameter and
-- the premium archive stores one file per year with no scoped variant, so what
-- is already here is REGPO and nothing else. The existing 38,028 rows are
-- therefore relabelled, not reinterpreted.
--
-- The grain moves from (pid, season_year) to (pid, season_year, season_type).
-- That is the point of the migration and also its main hazard: the three
-- writers all keyed their update WHERE on (pid, season_year), which under the
-- new grain matches every season type at once. They are re-keyed in the same
-- commit -- a deploy of this file without them silently clobbers the scoped
-- rows on the next live import.
--
-- The vocabulary is REG / POST / REGPO. REGPO is PFF's own spelling for the
-- combined value and is the DEFAULT, so a writer that predates this column
-- keeps writing the combined row it always wrote rather than failing. PRE and
-- PRO are deliberately absent: PFF publishes no preseason season-level grades,
-- and the REG/POST backfill skips those games.

ALTER TABLE public.pff_player_seasonlogs
    ADD COLUMN season_type character varying(10) NOT NULL DEFAULT 'REGPO';

ALTER TABLE public.pff_player_seasonlogs
    ADD CONSTRAINT pff_player_seasonlogs_season_type_vocabulary
    CHECK ((season_type)::text = ANY (ARRAY['REG'::text, 'POST'::text, 'REGPO'::text]));

ALTER TABLE public.pff_player_seasonlogs
    DROP CONSTRAINT pff_player_seasonlogs_pkey;

ALTER TABLE public.pff_player_seasonlogs
    ADD CONSTRAINT pff_player_seasonlogs_pkey PRIMARY KEY (pid, season_year, season_type);

-- The changelog carries the entity key of the row it describes, so it gains the
-- same column. The 14,528 rows written before this point describe REGPO rows
-- and the default labels them correctly.
ALTER TABLE public.pff_player_seasonlogs_changelog
    ADD COLUMN season_type character varying(10) NOT NULL DEFAULT 'REGPO';
