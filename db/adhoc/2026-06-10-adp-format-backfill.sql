-- Direct data migration: populate adp_format from the legacy adp_type values
-- present in the fact tables, then backfill adp_format_id on both tables.
-- Idempotent (ON CONFLICT DO NOTHING; WHERE adp_format_id IS NULL).
--
-- Runs AFTER the dimension DDL (2026-06-10-adp-format-dimension.sql) and BEFORE
-- the gated finalize. db:exec wraps this in a single transaction.
--
-- The decode VALUES mirror libs-shared/adp-format.mjs -- the runtime single
-- source the live importers use. This one-shot re-encodes the same injective
-- 19-row map directly in SQL (no node script / code deploy needed for the data
-- migration); the finalize injectivity gate verifies the result in data.
--
-- yarn db:exec db/adhoc/2026-06-10-adp-format-backfill.sql

-- The history backfill rewrites ~11.4M rows in this one maintenance transaction,
-- which exceeds the default per-statement timeout. Lift it for this transaction
-- only (crons are paused; player_adp_history is append-only, no contending writers).
SET LOCAL statement_timeout = 0;

CREATE TEMP TABLE adp_decode (
    adp_type text PRIMARY KEY,
    scoring_class text NOT NULL,
    num_qb smallint NOT NULL,
    duration text NOT NULL,
    draft_pool text NOT NULL,
    contest_style text NOT NULL
) ON COMMIT DROP;

INSERT INTO adp_decode (adp_type, scoring_class, num_qb, duration, draft_pool, contest_style) VALUES
    ('STANDARD_REDRAFT',           'STANDARD', 1, 'REDRAFT', 'ALL',    'MANAGED'),
    ('PPR_REDRAFT',                'PPR',      1, 'REDRAFT', 'ALL',    'MANAGED'),
    ('HALF_PPR_REDRAFT',           'HALF_PPR', 1, 'REDRAFT', 'ALL',    'MANAGED'),
    ('STANDARD_SUPERFLEX_REDRAFT', 'STANDARD', 2, 'REDRAFT', 'ALL',    'MANAGED'),
    ('PPR_SUPERFLEX_REDRAFT',      'PPR',      2, 'REDRAFT', 'ALL',    'MANAGED'),
    ('HALF_PPR_SUPERFLEX_REDRAFT', 'HALF_PPR', 2, 'REDRAFT', 'ALL',    'MANAGED'),
    ('STANDARD_DYNASTY',           'STANDARD', 1, 'DYNASTY', 'ALL',    'MANAGED'),
    ('PPR_DYNASTY',                'PPR',      1, 'DYNASTY', 'ALL',    'MANAGED'),
    ('HALF_PPR_DYNASTY',           'HALF_PPR', 1, 'DYNASTY', 'ALL',    'MANAGED'),
    ('STANDARD_SUPERFLEX_DYNASTY', 'STANDARD', 2, 'DYNASTY', 'ALL',    'MANAGED'),
    ('PPR_SUPERFLEX_DYNASTY',      'PPR',      2, 'DYNASTY', 'ALL',    'MANAGED'),
    ('HALF_PPR_SUPERFLEX_DYNASTY', 'HALF_PPR', 2, 'DYNASTY', 'ALL',    'MANAGED'),
    ('STANDARD_ROOKIE',            'STANDARD', 1, 'DYNASTY', 'ROOKIE', 'MANAGED'),
    ('PPR_ROOKIE',                 'PPR',      1, 'DYNASTY', 'ROOKIE', 'MANAGED'),
    ('HALF_PPR_ROOKIE',            'HALF_PPR', 1, 'DYNASTY', 'ROOKIE', 'MANAGED'),
    ('STANDARD_SUPERFLEX_ROOKIE',  'STANDARD', 2, 'DYNASTY', 'ROOKIE', 'MANAGED'),
    ('PPR_SUPERFLEX_ROOKIE',       'PPR',      2, 'DYNASTY', 'ROOKIE', 'MANAGED'),
    ('HALF_PPR_SUPERFLEX_ROOKIE',  'HALF_PPR', 2, 'DYNASTY', 'ROOKIE', 'MANAGED'),
    ('BESTBALL',                   'HALF_PPR', 1, 'REDRAFT', 'ALL',    'BEST_BALL');

-- 1. Mint an adp_format row for each legacy adp_type actually present in the data.
INSERT INTO public.adp_format
    (scoring_class, scoring_format_id, num_qb, num_teams, duration, draft_pool, contest_style)
SELECT DISTINCT
    d.scoring_class, NULL::text, d.num_qb, NULL::smallint, d.duration, d.draft_pool, d.contest_style
FROM adp_decode d
WHERE d.adp_type IN (
    SELECT adp_type::text FROM public.player_adp_index
    UNION
    SELECT adp_type::text FROM public.player_adp_history
)
ON CONFLICT (scoring_class, scoring_format_id, num_qb, num_teams, duration, draft_pool, contest_style)
DO NOTHING;

-- 2. Backfill player_adp_index (direct).
UPDATE public.player_adp_index i
SET adp_format_id = af.id
FROM adp_decode d
JOIN public.adp_format af
    ON af.scoring_class = d.scoring_class
   AND af.num_qb = d.num_qb
   AND af.duration = d.duration
   AND af.draft_pool = d.draft_pool
   AND af.contest_style = d.contest_style
   AND af.scoring_format_id IS NULL
   AND af.num_teams IS NULL
WHERE i.adp_type::text = d.adp_type
  AND i.adp_format_id IS NULL;

-- 3. Backfill player_adp_history (~11.1M rows; single statement, crons paused).
UPDATE public.player_adp_history h
SET adp_format_id = af.id
FROM adp_decode d
JOIN public.adp_format af
    ON af.scoring_class = d.scoring_class
   AND af.num_qb = d.num_qb
   AND af.duration = d.duration
   AND af.draft_pool = d.draft_pool
   AND af.contest_style = d.contest_style
   AND af.scoring_format_id IS NULL
   AND af.num_teams IS NULL
WHERE h.adp_type::text = d.adp_type
  AND h.adp_format_id IS NULL;

-- 4. Fail loudly if anything did not resolve (no row may be left null).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.player_adp_index WHERE adp_format_id IS NULL) THEN
        RAISE EXCEPTION 'player_adp_index has null adp_format_id after backfill';
    END IF;
    IF EXISTS (SELECT 1 FROM public.player_adp_history WHERE adp_format_id IS NULL) THEN
        RAISE EXCEPTION 'player_adp_history has null adp_format_id after backfill';
    END IF;
END $$;
