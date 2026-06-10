-- Create the adp_format dimension and add nullable adp_format_id FKs to both
-- ADP fact tables. Non-destructive (no drops).
--
-- adp_format normalizes the conflated legacy adp_type enum into independent
-- axis columns (scoring class, roster/superflex, duration, draft pool, contest
-- style). Identity is opaque (gen_random_uuid()); the dedup oracle is the
-- UNIQUE NULLS NOT DISTINCT index across the full axis tuple (PG 16.14+). The
-- closed-set axes are text + CHECK so a new value is a CHECK edit, not an
-- ALTER TYPE. The CHECK value sets mirror libs-shared/adp-format.mjs -- keep
-- the two in sync.
--
-- The legacy adp_type columns and enum are dropped later, in
-- db/adhoc/2026-06-10-adp-format-finalize.sql, gated on a complete consumer
-- cutover and run against paused writers.
--
-- See user:task/league/redesign-adp-schema-and-import-underdog-bestball.md
--
-- yarn db:exec db/adhoc/2026-06-10-adp-format-dimension.sql
-- yarn export:schema

CREATE TABLE IF NOT EXISTS public.adp_format (
    id text DEFAULT gen_random_uuid()::text NOT NULL,
    scoring_class text,
    scoring_format_id text,
    num_qb smallint DEFAULT 1 NOT NULL,
    num_teams smallint,
    duration text,
    draft_pool text DEFAULT 'ALL'::text NOT NULL,
    contest_style text DEFAULT 'MANAGED'::text NOT NULL,
    CONSTRAINT adp_format_scoring_class_check CHECK (scoring_class IN ('STANDARD', 'PPR', 'HALF_PPR')),
    CONSTRAINT adp_format_duration_check CHECK (duration IN ('REDRAFT', 'DYNASTY')),
    CONSTRAINT adp_format_draft_pool_check CHECK (draft_pool IN ('ALL', 'ROOKIE')),
    CONSTRAINT adp_format_contest_style_check CHECK (contest_style IN ('MANAGED', 'BEST_BALL')),
    CONSTRAINT adp_format_num_qb_check CHECK (num_qb >= 1)
);

ALTER TABLE ONLY public.adp_format
    ADD CONSTRAINT adp_format_pkey PRIMARY KEY (id);

-- dedup oracle: the full axis tuple. NULLS NOT DISTINCT so a null
-- scoring_format_id / num_teams collapses to a single row per axis combination.
CREATE UNIQUE INDEX adp_format_axis_unique ON public.adp_format
    USING btree (
        scoring_class, scoring_format_id, num_qb, num_teams, duration,
        draft_pool, contest_style
    ) NULLS NOT DISTINCT;

ALTER TABLE ONLY public.adp_format
    ADD CONSTRAINT adp_format_scoring_format_id_fkey FOREIGN KEY (scoring_format_id)
    REFERENCES public.league_scoring_formats(id) ON UPDATE CASCADE;

-- nullable FK on both fact tables; the NOT NULL set and the narrowed unique
-- constraint (year, source_id, adp_format_id, pid) come in the gated finalize.
ALTER TABLE public.player_adp_index ADD COLUMN IF NOT EXISTS adp_format_id text;
ALTER TABLE public.player_adp_history ADD COLUMN IF NOT EXISTS adp_format_id text;

ALTER TABLE ONLY public.player_adp_index
    ADD CONSTRAINT player_adp_index_adp_format_id_fkey FOREIGN KEY (adp_format_id)
    REFERENCES public.adp_format(id) ON UPDATE CASCADE;
ALTER TABLE ONLY public.player_adp_history
    ADD CONSTRAINT player_adp_history_adp_format_id_fkey FOREIGN KEY (adp_format_id)
    REFERENCES public.adp_format(id) ON UPDATE CASCADE;
