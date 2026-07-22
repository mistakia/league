-- Redesign league schema: player_prospect_profile SIS-abbreviation full expansion (identity-crosswalk cluster).
-- Full-word snake_case conform of the 224-col SIS draft-prospect table. Metadata-only RENAME COLUMN,
-- zero row rewrite. Glossary-backed (SIS NFL Draft glossary): TPTS=Total Points, FBI=Football
-- Intelligence, POA=Point of Attack, HOB=Hand on Ball, ATD=Adjusted Tackle Depth, Pos%=Positive%,
-- ST=Special Teams; IQR kept (proprietary metric name, like EPA). Sole consumer: private sis.mjs.
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "sis_id" TO sis_player_id;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "position" TO primary_position;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "team_abbr" TO team_abbreviation;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "team_sis_id" TO sis_team_id;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "critical_factor_fbi" TO critical_factor_football_intelligence;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "critical_factor_fbi_instincts" TO critical_factor_football_intelligence_instincts;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "critical_factor_3_level_impact" TO critical_factor_three_level_impact;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "critical_factor_3_down_ability" TO critical_factor_three_down_ability;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "critical_factor_1st_step_explosion" TO critical_factor_first_step_explosion;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "critical_factor_poa_set_edge" TO critical_factor_point_of_attack_set_edge;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "positional_factor_st_value" TO positional_factor_special_teams_value;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "positional_factor_3_level_impact" TO positional_factor_three_level_impact;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "positional_factor_qb_defense" TO positional_factor_quarterback_defense;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "positional_factor_pass_pro" TO positional_factor_pass_protection;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "positional_factor_2nd_level" TO positional_factor_second_level;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "positional_factor_body_comp" TO positional_factor_body_composition;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "positional_factor_fbi" TO positional_factor_football_intelligence;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "positional_factor_off_man" TO positional_factor_off_man_coverage;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "positional_factor_press_man" TO positional_factor_press_man_coverage;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "combine_forty_yd_dash" TO combine_forty_yard_dash;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "combine_forty_yd_dash_percentile" TO combine_forty_yard_dash_percentile;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "combine_forty_yd_dash_is_pro_day" TO combine_forty_yard_dash_is_pro_day;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "combine_vert_jump" TO combine_vertical_jump;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "combine_vert_jump_percentile" TO combine_vertical_jump_percentile;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "combine_vert_jump_is_pro_day" TO combine_vertical_jump_is_pro_day;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "combine_bench" TO combine_bench_press;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "combine_bench_percentile" TO combine_bench_press_percentile;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "combine_bench_is_pro_day" TO combine_bench_press_is_pro_day;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_tpts_per_game" TO stat_total_points_per_game;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_tpts_per_game_pass_cover" TO stat_total_points_per_game_pass_coverage;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_tpts_rating_overall" TO stat_total_points_rating_overall;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_tpts_rating_receiving" TO stat_total_points_rating_receiving;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_tpts_rating_blocking" TO stat_total_points_rating_blocking;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_blown_block_pct_pass" TO stat_blown_block_percentage_pass;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_blown_block_pct_rush" TO stat_blown_block_percentage_rush;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_catchable_catch_pct" TO stat_catchable_catch_percentage;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_tpts_rating_rushing" TO stat_total_points_rating_rushing;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_tpts_pass_block" TO stat_total_points_pass_block;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_positive_pct" TO stat_positive_percentage;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_boom_pct" TO stat_boom_percentage;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_tpts_rating_pass_cover" TO stat_total_points_rating_pass_coverage;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_tpts_rating_run_defense" TO stat_total_points_rating_run_defense;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_tpts_rating_pass_rush" TO stat_total_points_rating_pass_rush;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_hob_pct" TO stat_hand_on_ball_percentage;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_atd_plus" TO stat_adjusted_tackle_depth_plus;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_broken_missed_tackle_pct" TO stat_broken_missed_tackle_percentage;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_tpts_per_game_slot" TO stat_total_points_per_game_slot;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_tpts_per_game_wide" TO stat_total_points_per_game_wide;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_target_pct_plus_minus" TO stat_target_percentage_plus_minus;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_deep_route_pct" TO stat_deep_route_percentage;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_tpts_rating_passing" TO stat_total_points_rating_passing;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_catchable_pct" TO stat_catchable_percentage;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_on_target_pct" TO stat_on_target_percentage;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_deserved_catch_pct" TO stat_deserved_catch_percentage;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_slot_pct" TO stat_slot_percentage;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_box_pct" TO stat_box_percentage;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_tpts_rating_pass_block" TO stat_total_points_rating_pass_block;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_tpts_rating_run_block" TO stat_total_points_rating_run_block;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_blown_block_pct" TO stat_blown_block_percentage;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_run_behind_pct" TO stat_run_behind_percentage;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_pos_pct_run_behind" TO stat_positive_percentage_run_behind;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_bounce_pct" TO stat_bounce_percentage;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_tpts_per_game_press_cover" TO stat_total_points_per_game_press_coverage;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_pressure_pct_plus_minus" TO stat_pressure_percentage_plus_minus;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_true_pressure_pct" TO stat_true_pressure_percentage;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_quick_pressure_pct" TO stat_quick_pressure_percentage;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_tpts_per_game_rank" TO stat_total_points_per_game_rank;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_tpts_per_game_pass_cover_rank" TO stat_total_points_per_game_pass_coverage_rank;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_tpts_rating_overall_rank" TO stat_total_points_rating_overall_rank;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_tpts_rating_receiving_rank" TO stat_total_points_rating_receiving_rank;
ALTER TABLE public.player_prospect_profile
  RENAME COLUMN "stat_tpts_rating_blocking_rank" TO stat_total_points_rating_blocking_rank;
