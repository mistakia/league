-- STATUS: APPLIED 2026-08-05 against league_production
--
-- Boolean-prefix conformance: nfl_plays and nfl_plays_current_week
--
-- Retires 191 of the 249 boolean_prefix violations reported by
-- db/adhoc/audit-schema-conformance.mjs at ruler league cb578d8e7.
--
-- Every column renamed here was verified to be data_type = 'boolean' in
-- information_schema before the map was authored; the audit infers
-- boolean-ness from the dump and a false positive would rename a
-- non-boolean column.
--
-- nfl_plays is partitioned across 27 year children; the rename cascades from
-- the parent, so this takes ACCESS EXCLUSIVE on 28 relations plus the
-- standalone nfl_plays_current_week mirror. All 87 mirror columns are a strict
-- subset of nfl_plays and take identical new names.
--
-- Source of truth for the mapping:
--   scratch/league/schema-redesign/boolean-prefix-rename-map.json
-- Regenerate this file with:
--   node scratch/league/schema-redesign/build-boolean-prefix-ddl.mjs

BEGIN;

-- nfl_plays (104)
ALTER TABLE public.nfl_plays RENAME COLUMN assist_tk TO is_assist_tackle;
ALTER TABLE public.nfl_plays RENAME COLUMN batted_pass TO is_batted_pass;
ALTER TABLE public.nfl_plays RENAME COLUMN blitz TO is_blitz;
ALTER TABLE public.nfl_plays RENAME COLUMN catchable_ball TO is_catchable_ball;
ALTER TABLE public.nfl_plays RENAME COLUMN charted TO has_charting_data;
ALTER TABLE public.nfl_plays RENAME COLUMN comp TO is_completion;
ALTER TABLE public.nfl_plays RENAME COLUMN contested_ball TO is_contested_ball;
ALTER TABLE public.nfl_plays RENAME COLUMN created_reception TO is_created_reception;
ALTER TABLE public.nfl_plays RENAME COLUMN deleted TO is_deleted;
ALTER TABLE public.nfl_plays RENAME COLUMN drive_inside20 TO is_drive_inside_20;
ALTER TABLE public.nfl_plays RENAME COLUMN drive_score TO is_drive_score;
ALTER TABLE public.nfl_plays RENAME COLUMN dropped_pass TO is_dropped_pass;
ALTER TABLE public.nfl_plays RENAME COLUMN end_around_run TO is_end_around_run;
ALTER TABLE public.nfl_plays RENAME COLUMN endzone_target TO is_endzone_target;
ALTER TABLE public.nfl_plays RENAME COLUMN ep_att TO is_extra_point_attempt;
ALTER TABLE public.nfl_plays RENAME COLUMN ep_succ TO is_epa_successful;
ALTER TABLE public.nfl_plays RENAME COLUMN fake_field_goal TO is_fake_field_goal;
ALTER TABLE public.nfl_plays RENAME COLUMN fake_punt TO is_fake_punt;
ALTER TABLE public.nfl_plays RENAME COLUMN fg_att TO is_field_goal_attempt;
ALTER TABLE public.nfl_plays RENAME COLUMN fg_blocked TO is_field_goal_blocked;
ALTER TABLE public.nfl_plays RENAME COLUMN first_down TO is_first_down;
ALTER TABLE public.nfl_plays RENAME COLUMN first_down_pass TO is_first_down_pass;
ALTER TABLE public.nfl_plays RENAME COLUMN first_down_penalty TO is_first_down_penalty;
ALTER TABLE public.nfl_plays RENAME COLUMN first_down_rush TO is_first_down_rush;
ALTER TABLE public.nfl_plays RENAME COLUMN fourth_down_converted TO is_fourth_down_converted;
ALTER TABLE public.nfl_plays RENAME COLUMN fourth_down_failed TO is_fourth_down_failed;
ALTER TABLE public.nfl_plays RENAME COLUMN fum TO is_fumble;
ALTER TABLE public.nfl_plays RENAME COLUMN fumbles_lost TO is_fumble_lost;
ALTER TABLE public.nfl_plays RENAME COLUMN goal_to_go TO is_goal_to_go;
ALTER TABLE public.nfl_plays RENAME COLUMN highlight_pass TO is_highlight_pass;
ALTER TABLE public.nfl_plays RENAME COLUMN hindered_pass TO is_hindered_pass;
ALTER TABLE public.nfl_plays RENAME COLUMN incomp TO is_incompletion;
ALTER TABLE public.nfl_plays RENAME COLUMN int_worthy TO is_interception_worthy;
ALTER TABLE public.nfl_plays RENAME COLUMN interceptions TO is_interception;
ALTER TABLE public.nfl_plays RENAME COLUMN jet_sweep_run TO is_jet_sweep_run;
ALTER TABLE public.nfl_plays RENAME COLUMN kickoff_att TO is_kickoff_attempt;
ALTER TABLE public.nfl_plays RENAME COLUMN kickoff_onside TO is_kickoff_onside;
ALTER TABLE public.nfl_plays RENAME COLUMN kickoff_out_of_bounds TO is_kickoff_out_of_bounds;
ALTER TABLE public.nfl_plays RENAME COLUMN kickoff_touchback TO is_kickoff_touchback;
ALTER TABLE public.nfl_plays RENAME COLUMN lead_run TO is_lead_run;
ALTER TABLE public.nfl_plays RENAME COLUMN motion TO is_motion;
ALTER TABLE public.nfl_plays RENAME COLUMN motion_before_snap TO is_motion_before_snap;
ALTER TABLE public.nfl_plays RENAME COLUMN motion_during_snap TO is_motion_during_snap;
ALTER TABLE public.nfl_plays RENAME COLUMN no_huddle TO is_no_huddle;
ALTER TABLE public.nfl_plays RENAME COLUMN oob TO is_out_of_bounds;
ALTER TABLE public.nfl_plays RENAME COLUMN option_run TO is_option_run;
ALTER TABLE public.nfl_plays RENAME COLUMN out_of_pocket_pass TO is_out_of_pocket_pass;
ALTER TABLE public.nfl_plays RENAME COLUMN own_fumble_recovery TO is_own_fumble_recovery;
ALTER TABLE public.nfl_plays RENAME COLUMN pain_free_play TO is_pain_free_play;
ALTER TABLE public.nfl_plays RENAME COLUMN pass TO is_passing_play;
ALTER TABLE public.nfl_plays RENAME COLUMN pass_breakup TO is_pass_breakup;
ALTER TABLE public.nfl_plays RENAME COLUMN pass_td TO is_passing_touchdown;
ALTER TABLE public.nfl_plays RENAME COLUMN penalty TO is_penalty;
ALTER TABLE public.nfl_plays RENAME COLUMN penalty_declined TO is_penalty_declined;
ALTER TABLE public.nfl_plays RENAME COLUMN penalty_offset TO is_penalty_offset;
ALTER TABLE public.nfl_plays RENAME COLUMN phyb TO is_physical_ball;
ALTER TABLE public.nfl_plays RENAME COLUMN pitch_run TO is_pitch_run;
ALTER TABLE public.nfl_plays RENAME COLUMN play_action TO is_play_action;
ALTER TABLE public.nfl_plays RENAME COLUMN punt_att TO is_punt_attempt;
ALTER TABLE public.nfl_plays RENAME COLUMN punt_blocked TO is_punt_blocked;
ALTER TABLE public.nfl_plays RENAME COLUMN punt_fair_catch TO is_punt_fair_catch;
ALTER TABLE public.nfl_plays RENAME COLUMN punt_inside_20 TO is_punt_inside_20;
ALTER TABLE public.nfl_plays RENAME COLUMN punt_out_of_bounds TO is_punt_out_of_bounds;
ALTER TABLE public.nfl_plays RENAME COLUMN punt_touchback TO is_punt_touchback;
ALTER TABLE public.nfl_plays RENAME COLUMN qb_dropback TO is_qb_dropback;
ALTER TABLE public.nfl_plays RENAME COLUMN qb_fault_sack TO is_qb_fault_sack;
ALTER TABLE public.nfl_plays RENAME COLUMN qb_hit TO is_qb_hit;
ALTER TABLE public.nfl_plays RENAME COLUMN qb_hurry TO is_qb_hurry;
ALTER TABLE public.nfl_plays RENAME COLUMN qb_kneel TO is_qb_kneel;
ALTER TABLE public.nfl_plays RENAME COLUMN qb_left_pocket TO is_qb_left_pocket;
ALTER TABLE public.nfl_plays RENAME COLUMN qb_pressure TO is_qb_pressure;
ALTER TABLE public.nfl_plays RENAME COLUMN qb_pressure_tracking TO is_qb_pressure_tracking;
ALTER TABLE public.nfl_plays RENAME COLUMN qb_rush TO is_qb_rush;
ALTER TABLE public.nfl_plays RENAME COLUMN qb_scramble TO is_qb_scramble;
ALTER TABLE public.nfl_plays RENAME COLUMN qb_sneak TO is_qb_sneak;
ALTER TABLE public.nfl_plays RENAME COLUMN qb_spike TO is_qb_spike;
ALTER TABLE public.nfl_plays RENAME COLUMN ret_td TO is_return_touchdown;
ALTER TABLE public.nfl_plays RENAME COLUMN reverse_run TO is_reverse_run;
ALTER TABLE public.nfl_plays RENAME COLUMN run_play_option TO is_run_play_option;
ALTER TABLE public.nfl_plays RENAME COLUMN rush TO is_rushing_play;
ALTER TABLE public.nfl_plays RENAME COLUMN rush_td TO is_rushing_touchdown;
ALTER TABLE public.nfl_plays RENAME COLUMN safety TO is_safety;
ALTER TABLE public.nfl_plays RENAME COLUMN score TO is_scoring_play;
ALTER TABLE public.nfl_plays RENAME COLUMN screen_pass TO is_screen_pass;
ALTER TABLE public.nfl_plays RENAME COLUMN series_suc TO is_series_successful;
ALTER TABLE public.nfl_plays RENAME COLUMN shovel_pass TO is_shovel_pass;
ALTER TABLE public.nfl_plays RENAME COLUMN sideline_pass TO is_sideline_pass;
ALTER TABLE public.nfl_plays RENAME COLUMN sk TO is_sack;
ALTER TABLE public.nfl_plays RENAME COLUMN solo_tk TO is_solo_tackle;
ALTER TABLE public.nfl_plays RENAME COLUMN special TO is_special_teams_play;
ALTER TABLE public.nfl_plays RENAME COLUMN split_run TO is_split_run;
ALTER TABLE public.nfl_plays RENAME COLUMN stunt TO is_stunt;
ALTER TABLE public.nfl_plays RENAME COLUMN successful_play TO is_successful_play;
ALTER TABLE public.nfl_plays RENAME COLUMN td TO is_touchdown;
ALTER TABLE public.nfl_plays RENAME COLUMN tfl TO is_tackle_for_loss;
ALTER TABLE public.nfl_plays RENAME COLUMN third_down_converted TO is_third_down_converted;
ALTER TABLE public.nfl_plays RENAME COLUMN third_down_failed TO is_third_down_failed;
ALTER TABLE public.nfl_plays RENAME COLUMN throw_away TO is_throw_away;
ALTER TABLE public.nfl_plays RENAME COLUMN timeouts TO is_timeout;
ALTER TABLE public.nfl_plays RENAME COLUMN touchback TO is_touchback;
ALTER TABLE public.nfl_plays RENAME COLUMN trick_look TO is_trick_look;
ALTER TABLE public.nfl_plays RENAME COLUMN trick_play TO is_trick_play;
ALTER TABLE public.nfl_plays RENAME COLUMN two_att TO is_two_point_conversion_attempt;
ALTER TABLE public.nfl_plays RENAME COLUMN zero_blitz TO is_zero_blitz;

-- nfl_plays_current_week (87)
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN assist_tk TO is_assist_tackle;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN batted_pass TO is_batted_pass;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN catchable_ball TO is_catchable_ball;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN charted TO has_charting_data;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN comp TO is_completion;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN contested_ball TO is_contested_ball;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN created_reception TO is_created_reception;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN deleted TO is_deleted;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN drive_inside20 TO is_drive_inside_20;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN drive_score TO is_drive_score;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN dropped_pass TO is_dropped_pass;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN end_around_run TO is_end_around_run;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN ep_att TO is_extra_point_attempt;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN ep_succ TO is_epa_successful;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN fg_att TO is_field_goal_attempt;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN first_down TO is_first_down;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN first_down_pass TO is_first_down_pass;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN first_down_penalty TO is_first_down_penalty;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN first_down_rush TO is_first_down_rush;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN fourth_down_converted TO is_fourth_down_converted;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN fourth_down_failed TO is_fourth_down_failed;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN fum TO is_fumble;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN fumbles_lost TO is_fumble_lost;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN goal_to_go TO is_goal_to_go;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN highlight_pass TO is_highlight_pass;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN hindered_pass TO is_hindered_pass;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN incomp TO is_incompletion;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN int_worthy TO is_interception_worthy;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN interceptions TO is_interception;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN jet_sweep_run TO is_jet_sweep_run;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN kickoff_att TO is_kickoff_attempt;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN lead_run TO is_lead_run;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN motion TO is_motion;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN no_huddle TO is_no_huddle;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN oob TO is_out_of_bounds;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN option_run TO is_option_run;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN out_of_pocket_pass TO is_out_of_pocket_pass;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN own_fumble_recovery TO is_own_fumble_recovery;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN pain_free_play TO is_pain_free_play;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN pass TO is_passing_play;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN pass_td TO is_passing_touchdown;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN penalty TO is_penalty;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN phyb TO is_physical_ball;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN pitch_run TO is_pitch_run;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN play_action TO is_play_action;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN punt_att TO is_punt_attempt;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN punt_blocked TO is_punt_blocked;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN qb_dropback TO is_qb_dropback;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN qb_fault_sack TO is_qb_fault_sack;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN qb_hit TO is_qb_hit;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN qb_hurry TO is_qb_hurry;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN qb_kneel TO is_qb_kneel;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN qb_left_pocket TO is_qb_left_pocket;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN qb_pressure TO is_qb_pressure;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN qb_pressure_tracking TO is_qb_pressure_tracking;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN qb_rush TO is_qb_rush;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN qb_scramble TO is_qb_scramble;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN qb_sneak TO is_qb_sneak;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN qb_spike TO is_qb_spike;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN ret_td TO is_return_touchdown;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN reverse_run TO is_reverse_run;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN run_play_option TO is_run_play_option;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN rush TO is_rushing_play;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN rush_td TO is_rushing_touchdown;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN safety TO is_safety;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN score TO is_scoring_play;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN screen_pass TO is_screen_pass;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN series_suc TO is_series_successful;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN shovel_pass TO is_shovel_pass;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN sideline_pass TO is_sideline_pass;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN sk TO is_sack;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN solo_tk TO is_solo_tackle;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN special TO is_special_teams_play;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN split_run TO is_split_run;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN stunt TO is_stunt;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN successful_play TO is_successful_play;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN td TO is_touchdown;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN tfl TO is_tackle_for_loss;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN third_down_converted TO is_third_down_converted;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN third_down_failed TO is_third_down_failed;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN throw_away TO is_throw_away;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN timeouts TO is_timeout;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN touchback TO is_touchback;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN trick_look TO is_trick_look;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN trick_play TO is_trick_play;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN two_att TO is_two_point_conversion_attempt;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN zero_blitz TO is_zero_blitz;

COMMIT;
