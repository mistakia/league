-- Conform the remaining position columns to the canonical vocabulary
-- STATUS: APPLIED 2026-08-04 against league_production
--
-- Everything except player (already done) and the two derived logs
-- (player_gamelogs.pos, player_seasonlogs.pos), which are re-derived from
-- player.primary_position in their own file rather than conformed in place.
--
-- Five columns need no UPDATE and are absent below because their stored values
-- are already canonical: player_rankings_history.pos,
-- espn_receiving_metrics_history.pos, league_baselines.pos,
-- player_archetypes.primary_position and rosters_players.pos.
-- position_game_outcome_defaults.pos is likewise already canonical, and its pos
-- is part of the primary key, so conforming it in place would be a key change
-- rather than a value fix.
--
-- nfl_plays_player.position_group is RE-DERIVED from player_position rather
-- than conformed. Its vendor value SPEC (3,989 rows) is in neither the
-- vocabulary nor the alias map, and it decomposes exactly -- 1,373 P, 1,337 K,
-- 1,279 LS -- so re-deriving retires the vendor group column's independent
-- vocabulary instead of absorbing it.
--
-- pff_unresolved_players.position is deliberately NOT conformed. It is the
-- staging table for players PFF could not resolve, its ST value is a
-- special-teams catch-all rather than a position, and it is exempt from the
-- vocabulary constraint.

-- db:exec wraps the whole file in one transaction, so no explicit BEGIN here.

CREATE TEMPORARY TABLE position_alias (raw text PRIMARY KEY, canonical text NOT NULL) ON COMMIT DROP;
INSERT INTO position_alias (raw, canonical) VALUES
  ('OT','T'), ('LT','T'), ('RT','T'), ('OG','G'), ('LG','G'), ('RG','G'), ('OC','C'),
  ('ED','EDGE'), ('LDE','DE'), ('RDE','DE'), ('DI','DT'), ('DG','DT'), ('LDT','DT'), ('RDT','DT'),
  ('MIKE','MLB'), ('WILL','OLB'), ('LOLB','OLB'), ('ROLB','OLB'), ('LILB','ILB'), ('RILB','ILB'), ('$LB','LB'),
  ('SS','S'), ('FS','S'), ('SAF','S'), ('LCB','CB'), ('RCB','CB'),
  ('HB','RB'), ('H-B','RB'), ('TB','RB'), ('BB','RB'), ('WB','RB'),
  ('OE','TE'), ('E','TE'), ('FL','WR'), ('DEF','DST');

-- Total over the vocabulary: a group maps to itself.
CREATE TEMPORARY TABLE position_group_map (position text PRIMARY KEY, position_group text NOT NULL) ON COMMIT DROP;
INSERT INTO position_group_map (position, position_group) VALUES
  ('QB','QB'),
  ('RB','RB'), ('FB','RB'),
  ('WR','WR'),
  ('TE','TE'),
  ('OL','OL'), ('T','OL'), ('G','OL'), ('C','OL'),
  ('DL','DL'), ('DE','DL'), ('DT','DL'), ('NT','DL'), ('EDGE','DL'),
  ('LB','LB'), ('OLB','LB'), ('ILB','LB'), ('MLB','LB'),
  ('DB','DB'), ('CB','DB'), ('S','DB'),
  ('K','K'), ('P','P'), ('LS','LS'), ('DST','DST');

-- ------------------------------------------------- player_rankings_index ---

INSERT INTO public.position_vocabulary_backfill_audit (table_name, column_name, row_key, old_value, new_value)
SELECT 'player_rankings_index', 'pos',
  jsonb_build_object('pid', r.pid, 'season_year', r.season_year, 'source_id', r.source_id, 'ranking_type', r.ranking_type),
  r.pos, a.canonical
FROM public.player_rankings_index r JOIN position_alias a ON a.raw = r.pos;

UPDATE public.player_rankings_index r SET pos = a.canonical
FROM position_alias a WHERE a.raw = r.pos;

-- ----------------------------------------------------- player_adp_index ---

INSERT INTO public.position_vocabulary_backfill_audit (table_name, column_name, row_key, old_value, new_value)
SELECT 'player_adp_index', 'pos',
  jsonb_build_object('pid', d.pid, 'season_year', d.season_year, 'source_id', d.source_id, 'adp_format_id', d.adp_format_id),
  d.pos, a.canonical
FROM public.player_adp_index d JOIN position_alias a ON a.raw = d.pos;

UPDATE public.player_adp_index d SET pos = a.canonical
FROM position_alias a WHERE a.raw = d.pos;

-- --------------------------------------------------- player_adp_history ---

INSERT INTO public.position_vocabulary_backfill_audit (table_name, column_name, row_key, old_value, new_value)
SELECT 'player_adp_history', 'pos',
  jsonb_build_object('pid', d.pid, 'season_year', d.season_year, 'source_id', d.source_id, 'adp_format_id', d.adp_format_id, 'observed_at', d.observed_at),
  d.pos, a.canonical
FROM public.player_adp_history d JOIN position_alias a ON a.raw = d.pos;

UPDATE public.player_adp_history d SET pos = a.canonical
FROM position_alias a WHERE a.raw = d.pos;

-- ------------------------------------------------ pff_player_seasonlogs ---

INSERT INTO public.position_vocabulary_backfill_audit (table_name, column_name, row_key, old_value, new_value)
SELECT 'pff_player_seasonlogs', 'position',
  jsonb_build_object('pid', s.pid, 'season_year', s.season_year), s.position, a.canonical
FROM public.pff_player_seasonlogs s JOIN position_alias a ON a.raw = s.position;

UPDATE public.pff_player_seasonlogs s SET position = a.canonical
FROM position_alias a WHERE a.raw = s.position;

INSERT INTO public.position_vocabulary_backfill_audit (table_name, column_name, row_key, old_value, new_value)
SELECT 'pff_player_seasonlogs', 'grade_position',
  jsonb_build_object('pid', s.pid, 'season_year', s.season_year), s.grade_position, a.canonical
FROM public.pff_player_seasonlogs s JOIN position_alias a ON a.raw = s.grade_position;

UPDATE public.pff_player_seasonlogs s SET grade_position = a.canonical
FROM position_alias a WHERE a.raw = s.grade_position;

-- ------------------------------------------ pff_player_facet_seasonlogs ---

INSERT INTO public.position_vocabulary_backfill_audit (table_name, column_name, row_key, old_value, new_value)
SELECT 'pff_player_facet_seasonlogs', 'position',
  jsonb_build_object('pid', s.pid, 'season_year', s.season_year, 'facet', s.facet), s.position, a.canonical
FROM public.pff_player_facet_seasonlogs s JOIN position_alias a ON a.raw = s.position;

UPDATE public.pff_player_facet_seasonlogs s SET position = a.canonical
FROM position_alias a WHERE a.raw = s.position;

-- ------------------------------------------------ player_prospect_profile ---
-- Entirely lowercase in production (cb, wr, ed, mike, will, ...), so this
-- upper-cases first and then resolves aliases.

INSERT INTO public.position_vocabulary_backfill_audit (table_name, column_name, row_key, old_value, new_value)
SELECT 'player_prospect_profile', 'primary_position',
  jsonb_build_object('pid', p.pid), p.primary_position,
  coalesce(a.canonical, upper(btrim(p.primary_position)))
FROM public.player_prospect_profile p
LEFT JOIN position_alias a ON a.raw = upper(btrim(p.primary_position))
WHERE p.primary_position IS NOT NULL
  AND p.primary_position IS DISTINCT FROM coalesce(a.canonical, upper(btrim(p.primary_position)));

UPDATE public.player_prospect_profile p
SET primary_position = coalesce(
  (SELECT a.canonical FROM position_alias a WHERE a.raw = upper(btrim(p.primary_position))),
  upper(btrim(p.primary_position))
)
WHERE p.primary_position IS NOT NULL;

-- ------------------------------- weekly_market_selections_analysis_cache ---

INSERT INTO public.position_vocabulary_backfill_audit (table_name, column_name, row_key, old_value, new_value)
SELECT 'weekly_market_selections_analysis_cache', 'player_position',
  jsonb_build_object('source_id', w.source_id, 'source_market_id', w.source_market_id, 'source_selection_id', w.source_selection_id),
  w.player_position, a.canonical
FROM public.weekly_market_selections_analysis_cache w JOIN position_alias a ON a.raw = w.player_position;

UPDATE public.weekly_market_selections_analysis_cache w SET player_position = a.canonical
FROM position_alias a WHERE a.raw = w.player_position;

-- ------------------------------------------------------------ props_index ---

INSERT INTO public.position_vocabulary_backfill_audit (table_name, column_name, row_key, old_value, new_value)
SELECT 'props_index', 'player_position', jsonb_build_object('prop_id', p.prop_id), p.player_position, a.canonical
FROM public.props_index p JOIN position_alias a ON a.raw = p.player_position;

UPDATE public.props_index p SET player_position = a.canonical
FROM position_alias a WHERE a.raw = p.player_position;

-- ------------------------------------------------------ nfl_plays_player ---

INSERT INTO public.position_vocabulary_backfill_audit (table_name, column_name, row_key, old_value, new_value)
SELECT 'nfl_plays_player', 'player_position',
  jsonb_build_object('esbid', n.esbid, 'play_id', n.play_id, 'season_year', n.season_year, 'gsis_it_id', n.gsis_it_id),
  n.player_position, a.canonical
FROM public.nfl_plays_player n JOIN position_alias a ON a.raw = n.player_position;

UPDATE public.nfl_plays_player n SET player_position = a.canonical
FROM position_alias a WHERE a.raw = n.player_position;

-- position_group re-derived from the now-canonical player_position.
INSERT INTO public.position_vocabulary_backfill_audit (table_name, column_name, row_key, old_value, new_value)
SELECT 'nfl_plays_player', 'position_group',
  jsonb_build_object('esbid', n.esbid, 'play_id', n.play_id, 'season_year', n.season_year, 'gsis_it_id', n.gsis_it_id),
  n.position_group, g.position_group
FROM public.nfl_plays_player n JOIN position_group_map g ON g.position = n.player_position
WHERE n.position_group IS DISTINCT FROM g.position_group;

UPDATE public.nfl_plays_player n SET position_group = g.position_group
FROM position_group_map g
WHERE g.position = n.player_position AND n.position_group IS DISTINCT FROM g.position_group;
