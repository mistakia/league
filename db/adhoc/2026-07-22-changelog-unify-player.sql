-- Unify player_changelog (68.6M rows) onto the canonical changelog shape.
--
-- GATED: full table rewrite. Preconditions (see runbook / task):
--   - fresh off-VPS full backup validated
--   - opus review of this DDL
--   - applied in the offseason quiet window (no live-plays worker; time
--     outside the 03:30 sleeper import cron)
--
-- Done as a CREATE + INSERT SELECT + swap rather than in-place ALTER so the
-- new table gets the clean canonical column order and a fresh `id` identity
-- built once over settled data. This is a pure retype: the pid re-key already
-- cleaned pid-bearing audit history, so no value remap — only prop->column_name,
-- prev/new->previous_value/new_value, and "timestamp"(int epoch) ->
-- changed_at(timestamptz) via to_timestamp(). Existing rows already carry a
-- real source ('sleeper' default or 'nflverse-backfill'); no source backfill.
--
-- yarn db:exec wraps this in a single transaction: readers see the old table
-- until commit, and the row-count parity guard aborts the whole swap on any
-- mismatch before the old table is dropped.

CREATE TABLE public.player_changelog_new (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pid character varying(25),
  column_name text NOT NULL,
  previous_value text,
  new_value text,
  source text NOT NULL,
  reason text,
  changed_at timestamptz NOT NULL
);

-- Serialize against any concurrent writer for the whole rewrite. Held to
-- COMMIT, this guarantees the INSERT SELECT captures every committed row (the
-- parity guard below can never trip on a concurrent write) and no write is
-- lost: a blocked writer resumes after the swap and resolves the table name to
-- the new table. In the offseason apply window there are no live readers, so
-- acquiring the lock is immediate.
LOCK TABLE public.player_changelog IN ACCESS EXCLUSIVE MODE;

INSERT INTO public.player_changelog_new
  (pid, column_name, previous_value, new_value, source, reason, changed_at)
SELECT
  pid,
  prop,
  prev,
  new,
  source,
  NULL,
  to_timestamp("timestamp")
FROM public.player_changelog;

ALTER TABLE public.player_changelog RENAME TO player_changelog_old;
ALTER TABLE public.player_changelog_new RENAME TO player_changelog;

-- Shed the transitional "_new" names left by the create-swap so the final
-- objects read as if built clean.
ALTER TABLE public.player_changelog
  RENAME CONSTRAINT player_changelog_new_pkey TO player_changelog_pkey;
ALTER SEQUENCE public.player_changelog_new_id_seq
  RENAME TO player_changelog_id_seq;

-- Preserve the reader grant the old table carried.
GRANT SELECT ON TABLE public.player_changelog TO league_reader;

-- Abort the swap if the rewrite dropped or duplicated any row.
DO $$
DECLARE
  old_ct bigint;
  new_ct bigint;
BEGIN
  SELECT count(*) INTO old_ct FROM public.player_changelog_old;
  SELECT count(*) INTO new_ct FROM public.player_changelog;
  IF old_ct <> new_ct THEN
    RAISE EXCEPTION 'player_changelog row-count mismatch: old=% new=%', old_ct, new_ct;
  END IF;
END $$;

DROP TABLE public.player_changelog_old;
DROP SEQUENCE IF EXISTS public.player_changelog_uid_seq;
