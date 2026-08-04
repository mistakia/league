-- Re-derive player_gamelogs.pos and player_seasonlogs.pos from player
-- STATUS: APPLIED 2026-08-04 against league_production
--
-- Both columns duplicate player.primary_position by definition -- the gamelog
-- generator writes it from there, and so does every other writer after the
-- importer sweep. Two snapshots of the same unnormalized column taken years
-- apart is what put OLB alongside LB and 111 K/P flips in the gamelogs.
--
-- 164,091 of 885,540 gamelog rows and 2,416 of 105,732 seasonlog rows differ.
-- Most of that is the alias fold (OLB -> LB, T -> OL, SS -> DB); the K/P share
-- is the corrected 63 players' history.
--
-- Readers are unaffected. This takes row locks, not a table lock, and Postgres
-- readers do not block on row locks -- process-projections reads player_gamelogs
-- every 30 minutes and will see the pre-update snapshot until this commits.
--
-- Rows whose pid has no player row are left alone rather than nulled; pos is
-- NOT NULL on both tables and an orphan gamelog has no derivation source.

-- db:exec wraps the whole file in one transaction, so no explicit BEGIN here.

INSERT INTO public.position_vocabulary_backfill_audit (table_name, column_name, row_key, old_value, new_value)
SELECT 'player_gamelogs', 'pos',
  jsonb_build_object('esbid', g.esbid, 'pid', g.pid, 'season_year', g.season_year),
  g.pos, p.primary_position
FROM public.player_gamelogs g
JOIN public.player p ON p.pid = g.pid
WHERE g.pos IS DISTINCT FROM p.primary_position;

UPDATE public.player_gamelogs g SET pos = p.primary_position
FROM public.player p
WHERE p.pid = g.pid AND g.pos IS DISTINCT FROM p.primary_position;

INSERT INTO public.position_vocabulary_backfill_audit (table_name, column_name, row_key, old_value, new_value)
SELECT 'player_seasonlogs', 'pos',
  jsonb_build_object('pid', s.pid, 'season_year', s.season_year, 'season_type', s.season_type),
  s.pos, p.primary_position
FROM public.player_seasonlogs s
JOIN public.player p ON p.pid = s.pid
WHERE s.pos IS DISTINCT FROM p.primary_position;

UPDATE public.player_seasonlogs s SET pos = p.primary_position
FROM public.player p
WHERE p.pid = s.pid AND s.pos IS DISTINCT FROM p.primary_position;
