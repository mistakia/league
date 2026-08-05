-- STATUS: APPLIED 2026-08-05 against league_production
--
-- Shorthand conformance: the plays family
--
-- Retires 47 of the 234 shorthand violations reported by
-- db/adhoc/audit-schema-conformance.mjs at ruler league 74b1366cd.
--
-- Expands abbreviated column names to full words. Every (table, column) here
-- was verified present in information_schema, and every proposed name verified
-- NOT already taken on its table, against production before this file was
-- authored.
--
-- nfl_plays is partitioned across 27 year children and player_gamelogs across
-- 28; the rename cascades from the parent, so a child must never be renamed
-- directly (Postgres rejects it with "cannot rename inherited column"). This
-- takes ACCESS EXCLUSIVE on 57 relations in the two partition trees, plus the
-- standalone nfl_plays_current_week mirror and the small stats tables.
--
-- ORDERING: apply only AFTER the boolean-prefix sweep
-- (db/adhoc/2026-08-04-conform-boolean-prefix-*.sql) has landed its DDL and
-- committed its consumer sweep. The two programs are disjoint on
-- (table, column) -- verified both directions -- but they share this schema.
--
-- Source of truth for the mapping:
--   db/adhoc/shorthand-rename-map.json

-- nfl_play_stats (1)
ALTER TABLE public.nfl_play_stats RENAME COLUMN yards TO stat_yards;

-- nfl_play_stats_current_week (1)
ALTER TABLE public.nfl_play_stats_current_week RENAME COLUMN yards TO stat_yards;

-- nfl_plays (21)
ALTER TABLE public.nfl_plays RENAME COLUMN avsk TO avoided_sacks;
ALTER TABLE public.nfl_plays RENAME COLUMN back TO backfield_player_count;
ALTER TABLE public.nfl_plays RENAME COLUMN boxdb TO defensive_backs_in_box;
ALTER TABLE public.nfl_plays RENAME COLUMN cov TO coverage_on_target;
ALTER TABLE public.nfl_plays RENAME COLUMN cp TO completion_probability;
ALTER TABLE public.nfl_plays RENAME COLUMN cpoe TO completion_percentage_over_expected;
ALTER TABLE public.nfl_plays RENAME COLUMN db TO defensive_back_count;
ALTER TABLE public.nfl_plays RENAME COLUMN dot TO depth_of_target;
ALTER TABLE public.nfl_plays RENAME COLUMN dwn TO down_number;
ALTER TABLE public.nfl_plays RENAME COLUMN ep TO expected_points;
ALTER TABLE public.nfl_plays RENAME COLUMN mbt TO missed_or_broken_tackle;
ALTER TABLE public.nfl_plays RENAME COLUMN oopd TO out_of_pocket_details;
ALTER TABLE public.nfl_plays RENAME COLUMN pru TO ngs_pass_rushers;
ALTER TABLE public.nfl_plays RENAME COLUMN qtr TO quarter;
ALTER TABLE public.nfl_plays RENAME COLUMN route TO charted_route;
ALTER TABLE public.nfl_plays RENAME COLUMN sep TO receiver_separation;
ALTER TABLE public.nfl_plays RENAME COLUMN ttsk TO time_to_sack;
ALTER TABLE public.nfl_plays RENAME COLUMN wp TO win_probability;
ALTER TABLE public.nfl_plays RENAME COLUMN wpa TO win_probability_added;
ALTER TABLE public.nfl_plays RENAME COLUMN xlm TO extra_men_on_line;
ALTER TABLE public.nfl_plays RENAME COLUMN yfog TO yards_from_own_goal;

-- nfl_plays_current_week (21)
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN avsk TO avoided_sacks;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN back TO backfield_player_count;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN boxdb TO defensive_backs_in_box;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN cov TO coverage_on_target;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN cp TO completion_probability;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN cpoe TO completion_percentage_over_expected;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN db TO defensive_back_count;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN dot TO depth_of_target;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN dwn TO down_number;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN ep TO expected_points;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN mbt TO missed_or_broken_tackle;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN oopd TO out_of_pocket_details;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN pru TO ngs_pass_rushers;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN qtr TO quarter;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN route TO charted_route;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN sep TO receiver_separation;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN ttsk TO time_to_sack;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN wp TO win_probability;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN wpa TO win_probability_added;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN xlm TO extra_men_on_line;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN yfog TO yards_from_own_goal;

-- nfl_plays_receiver (1)
ALTER TABLE public.nfl_plays_receiver RENAME COLUMN route TO route_run;

-- player_gamelogs (2)
ALTER TABLE public.player_gamelogs RENAME COLUMN jnum TO jersey_number;
ALTER TABLE public.player_gamelogs RENAME COLUMN pos TO player_position;
