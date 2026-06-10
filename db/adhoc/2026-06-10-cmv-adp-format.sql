-- Migrate the composite-market-value coupling onto adp_format (non-destructive).
--
-- Adds a nullable adp_format_id (FK -> adp_format) to
-- format_category_signal_mapping and backfills it from the legacy adp_type. The
-- legacy adp_type column is NOT dropped here -- it is dropped in the gated
-- finalize (db/adhoc/2026-06-10-adp-format-finalize.sql) alongside the
-- fact-table columns so all destructive DDL stays in one backed-up step.
--
-- Backfill is single-source: it joins to the already-migrated player_adp_index,
-- which derived adp_format_id from the libs-shared/adp-format.mjs decode map.
-- This file therefore MUST run AFTER the fact-table data migration
-- (scripts/migrate-adp-type-to-adp-format.mjs). The 6 CMV mapping rows are all
-- Sleeper dynasty/superflex types, which the Sleeper importer always populates,
-- so each adp_type is present in player_adp_index. The DO block fails loudly if
-- any row did not resolve.
--
-- See user:task/league/redesign-adp-schema-and-import-underdog-bestball.md
--
-- yarn db:exec db/adhoc/2026-06-10-cmv-adp-format.sql
-- yarn export:schema

ALTER TABLE public.format_category_signal_mapping
    ADD COLUMN IF NOT EXISTS adp_format_id text;

ALTER TABLE ONLY public.format_category_signal_mapping
    ADD CONSTRAINT format_category_signal_mapping_adp_format_id_fkey
    FOREIGN KEY (adp_format_id) REFERENCES public.adp_format(id) ON UPDATE CASCADE;

UPDATE public.format_category_signal_mapping m
SET adp_format_id = sub.adp_format_id
FROM (
    SELECT DISTINCT adp_type::text AS adp_type, adp_format_id
    FROM public.player_adp_index
    WHERE adp_format_id IS NOT NULL
) sub
WHERE m.adp_type = sub.adp_type
  AND m.adp_format_id IS NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.format_category_signal_mapping
        WHERE adp_format_id IS NULL
    ) THEN
        RAISE EXCEPTION 'format_category_signal_mapping has rows with null adp_format_id after backfill -- a CMV adp_type did not resolve via player_adp_index';
    END IF;
END $$;
