-- FINALIZE (DESTRUCTIVE, IRREVERSIBLE): swap the ADP unique constraint to
-- adp_format_id, set NOT NULL, and drop every legacy adp_type (both fact tables,
-- format_category_signal_mapping, and the enum type).
--
-- GATED. Run LAST, only after:
--   1. ADP import crons are paused (see server/crontab-main/league-imports.cron;
--      verify on the remote: ssh league 'crontab -l | grep sleeper-adp' shows it
--      commented). No ADP importer process running: pgrep -f "import-.*-adp".
--   2. Every consumer is repointed. Verify NO live adp_type COLUMN usage remains
--      (the decode-map machinery legitimately contains the substring adp_type in
--      names like decode_adp_type / adp_types, so grep precisely, not literally):
--        grep -rnE "adp_type:|'adp_type'|\"adp_type\"|\.adp_type|->.?'adp_type'|mapping\.adp_type|\.where\('adp_type'|onConflict\([^)]*adp_type" \
--          scripts/ libs-server/ libs-shared/ app/
--      Expect no matches outside db/adhoc/ historical SQL.
--   3. The dimension DDL, fact-table data migration, and CMV migration have all
--      run against prod (adp_format_id populated everywhere).
--
-- PRE-DROP BACKUP (run on the league host BEFORE db:exec, out of band):
--   ssh league "pg_dump -U league_user -h localhost --dbname=league_production \
--     -t public.player_adp_index -t public.player_adp_history \
--     -t public.format_category_signal_mapping \
--     --file=/root/adp-pre-finalize-backup-2026-06-10.sql"
--
-- The fum_ret_td incident (user:guideline/schema/avoid-content-derived-identity.md)
-- is the cautionary precedent for an irreversible identifier drop -- do not skip
-- the backup or the gates.
--
-- yarn db:exec db/adhoc/2026-06-10-adp-format-finalize.sql   (single transaction, ON_ERROR_STOP=1)
-- yarn export:schema

-- ---------------------------------------------------------------------------
-- Gate 1: no null adp_format_id on either fact table.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.player_adp_index WHERE adp_format_id IS NULL) THEN
        RAISE EXCEPTION 'player_adp_index has rows with null adp_format_id -- migration incomplete';
    END IF;
    IF EXISTS (SELECT 1 FROM public.player_adp_history WHERE adp_format_id IS NULL) THEN
        RAISE EXCEPTION 'player_adp_history has rows with null adp_format_id -- migration incomplete';
    END IF;
    IF EXISTS (SELECT 1 FROM public.format_category_signal_mapping WHERE adp_format_id IS NULL) THEN
        RAISE EXCEPTION 'format_category_signal_mapping has rows with null adp_format_id -- CMV migration incomplete';
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Gate 2: data-level injectivity. The decode map must not have collapsed
-- distinct adp_type values onto a shared adp_format_id, which would make the
-- narrowed unique constraint drop rows. Checked while adp_type still exists.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    n_type integer;
    n_format integer;
BEGIN
    SELECT count(DISTINCT adp_type), count(DISTINCT adp_format_id)
    INTO n_type, n_format
    FROM public.player_adp_index;
    IF n_type <> n_format THEN
        RAISE EXCEPTION 'injectivity violated in player_adp_index: % distinct adp_type vs % distinct adp_format_id', n_type, n_format;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Swap the unique constraint on player_adp_index.
-- ---------------------------------------------------------------------------
ALTER TABLE public.player_adp_index DROP CONSTRAINT player_adp_index_unique;
ALTER TABLE public.player_adp_index
    ADD CONSTRAINT player_adp_index_unique UNIQUE (year, source_id, adp_format_id, pid);

-- ---------------------------------------------------------------------------
-- NOT NULL the FK columns now that they are fully populated.
-- ---------------------------------------------------------------------------
ALTER TABLE public.player_adp_index ALTER COLUMN adp_format_id SET NOT NULL;
ALTER TABLE public.player_adp_history ALTER COLUMN adp_format_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Drop the legacy adp_type columns. This auto-drops the dependent
-- idx_*_source_type indexes; recreate their adp_format_id equivalents so the
-- (source_id, format) lookup topology is preserved.
-- ---------------------------------------------------------------------------
ALTER TABLE public.player_adp_index DROP COLUMN adp_type;
ALTER TABLE public.player_adp_history DROP COLUMN adp_type;
ALTER TABLE public.format_category_signal_mapping DROP COLUMN adp_type;

CREATE INDEX idx_player_adp_index_source_format ON public.player_adp_index
    USING btree (source_id, adp_format_id);
CREATE INDEX idx_player_adp_history_source_format ON public.player_adp_history
    USING btree (source_id, adp_format_id);

-- ---------------------------------------------------------------------------
-- Drop the now-unreferenced enum type.
-- ---------------------------------------------------------------------------
DROP TYPE public.adp_type;
