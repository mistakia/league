-- STATUS: APPLIED 2026-08-17 against league_production
-- Conform the quarter family on player_gamelogs:
-- q1-q4 -> quarter_1 through quarter_4, 16 columns.
--
-- The target is the plan coined identifier: q1_snaps_off ->
-- quarter_1_snaps_offense (the side-prefix batch already expanded
-- off/def on these columns, so only the quarter token remains).
--
SET lock_timeout = '30s';
SET statement_timeout = 0;

ALTER TABLE public.player_gamelogs RENAME COLUMN q1_snaps_offense TO quarter_1_snaps_offense;
ALTER TABLE public.player_gamelogs RENAME COLUMN q1_snaps_offense_percentage TO quarter_1_snaps_offense_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN q1_snaps_defense TO quarter_1_snaps_defense;
ALTER TABLE public.player_gamelogs RENAME COLUMN q1_snaps_defense_percentage TO quarter_1_snaps_defense_percentage;

ALTER TABLE public.player_gamelogs RENAME COLUMN q2_snaps_offense TO quarter_2_snaps_offense;
ALTER TABLE public.player_gamelogs RENAME COLUMN q2_snaps_offense_percentage TO quarter_2_snaps_offense_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN q2_snaps_defense TO quarter_2_snaps_defense;
ALTER TABLE public.player_gamelogs RENAME COLUMN q2_snaps_defense_percentage TO quarter_2_snaps_defense_percentage;

ALTER TABLE public.player_gamelogs RENAME COLUMN q3_snaps_offense TO quarter_3_snaps_offense;
ALTER TABLE public.player_gamelogs RENAME COLUMN q3_snaps_offense_percentage TO quarter_3_snaps_offense_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN q3_snaps_defense TO quarter_3_snaps_defense;
ALTER TABLE public.player_gamelogs RENAME COLUMN q3_snaps_defense_percentage TO quarter_3_snaps_defense_percentage;

ALTER TABLE public.player_gamelogs RENAME COLUMN q4_snaps_offense TO quarter_4_snaps_offense;
ALTER TABLE public.player_gamelogs RENAME COLUMN q4_snaps_offense_percentage TO quarter_4_snaps_offense_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN q4_snaps_defense TO quarter_4_snaps_defense;
ALTER TABLE public.player_gamelogs RENAME COLUMN q4_snaps_defense_percentage TO quarter_4_snaps_defense_percentage;
