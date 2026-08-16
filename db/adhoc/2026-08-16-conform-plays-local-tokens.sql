-- STATUS: APPLIED 2026-08-16 against league_production
--
-- Conform the plays-local shorthand tokens on nfl_plays and
-- nfl_plays_current_week to full words, in one transaction, each column landing
-- its final name for the tokens this batch owns.
--
-- THE RULING. Every abbreviation token must be spelled in full words; the
-- full-word rule in guideline/nfl/league/database-schema-standards.md admits
-- exactly one closed list of ratified abbreviations (id, url), and none of the
-- tokens below is on it. Operator rulings 2026-08-15 settle the token set; this
-- batch is the reference batch for the conform campaign -- every one of its
-- tokens lives ONLY on these two tables, so it proves the recipe against the
-- heaviest consumer surface at the smallest table count.
--
-- SCOPE. 91 columns: 46 on nfl_plays, 45 on nfl_plays_current_week (the
-- current-week table carries every column except desc_nflfastr). nfl_plays is
-- partitioned; ALTER TABLE ... RENAME COLUMN propagates to every partition
-- child at catalog level, so no per-child DDL is needed.
--
-- TOKEN EXPANSIONS (in place):
--   ydl -> yard_line      rem -> remaining       wp -> win_probability
--   qtr -> quarter        sec -> seconds         pp -> per_play
--   seq -> sequence       fuml -> fumble_lost    ret -> return
--   tm -> nfl_team        diff -> difference     bc -> ball_carrier
--   psr -> passer         trg -> target          intp -> interceptor
--   fds -> first_downs    gm -> game             succ -> success
--   fd -> first_down      conv -> conversion     oe -> over_expected
--   n -> number           tp -> two_point        desc -> play_description
--
-- SENSE-DEPENDENT TARGETS, settled here rather than derived at execution time
-- (the audit can only say the token is non-conforming; which word is right is
-- per column):
--   to -> timeouts, NOT the English word "to". away_to_rem / def_to_rem /
--     home_to_rem / pos_to_rem carry the column comment "timeouts remaining";
--     to is a dictionary word so the audit cannot see it, the same class as the
--     db sense-split, and it is expanded here so no to_rem column ships a
--     half-spelling.
--   fuml -> fumble_lost. player_fuml_pid -> fumble_lost_pid (role reference,
--     mirroring the conformed {role}_pid family: ball_carrier_pid, passer_pid,
--     interceptor_pid); player_fuml_gsis -> fumble_lost_gsis_player_id. The
--     role-gsis columns (bc_gsis, psr_gsis, trg_gsis, intp_gsis) follow the
--     same {role}_gsis_player_id form, consistent with player.gsis_player_id.
--
-- INTERIM SPELLINGS (deliberate). A column carrying a token owned by a later
-- batch keeps that token abbreviated and lands only the tokens this batch owns:
--   off_personnel_{rb,te,wr}_count_pp -> off_personnel_{rb,te,wr}_count_per_play
--     (off/offense, rb, te, wr land with the side and format batches)
--   ret_yds -> return_yds (yds/yards with the counting batch)
--   td_tm -> td_nfl_team (td/touchdown with the counting batch)
--   pos_to_rem -> pos_timeouts_remaining (pos/possession with the long tail)
--   xyac_{fd,succ}_prob -> xyac_{first_down,success}_prob (prob/probability
--     with the markets batch)
--   ydl_num -> yard_line_num (num/number with the long tail)
--   two_conv_prob -> two_conversion_prob (prob/probability with the markets
--     batch)
-- No column ever carries a half-spelling of a token this batch owns.
--
SET lock_timeout = '30s';
SET statement_timeout = 0;

ALTER TABLE public.nfl_plays RENAME COLUMN away_to_rem TO away_timeouts_remaining;
ALTER TABLE public.nfl_plays RENAME COLUMN away_wp TO away_win_probability;
ALTER TABLE public.nfl_plays RENAME COLUMN away_wp_post TO away_win_probability_post;
ALTER TABLE public.nfl_plays RENAME COLUMN bc_gsis TO ball_carrier_gsis_player_id;
ALTER TABLE public.nfl_plays RENAME COLUMN def_to_rem TO def_timeouts_remaining;
ALTER TABLE public.nfl_plays RENAME COLUMN desc_nflfastr TO play_description_nflfastr;
ALTER TABLE public.nfl_plays RENAME COLUMN drive_end_qtr TO drive_end_quarter;
ALTER TABLE public.nfl_plays RENAME COLUMN drive_end_ydl TO drive_end_yard_line;
ALTER TABLE public.nfl_plays RENAME COLUMN drive_fds TO drive_first_downs;
ALTER TABLE public.nfl_plays RENAME COLUMN drive_seq TO drive_sequence;
ALTER TABLE public.nfl_plays RENAME COLUMN drive_start_qtr TO drive_start_quarter;
ALTER TABLE public.nfl_plays RENAME COLUMN drive_start_ydl TO drive_start_yard_line;
ALTER TABLE public.nfl_plays RENAME COLUMN home_to_rem TO home_timeouts_remaining;
ALTER TABLE public.nfl_plays RENAME COLUMN home_wp TO home_win_probability;
ALTER TABLE public.nfl_plays RENAME COLUMN home_wp_post TO home_win_probability_post;
ALTER TABLE public.nfl_plays RENAME COLUMN intp_gsis TO interceptor_gsis_player_id;
ALTER TABLE public.nfl_plays RENAME COLUMN n_offense_backfield TO number_offense_backfield;
ALTER TABLE public.nfl_plays RENAME COLUMN off_personnel_rb_count_pp TO off_personnel_rb_count_per_play;
ALTER TABLE public.nfl_plays RENAME COLUMN off_personnel_te_count_pp TO off_personnel_te_count_per_play;
ALTER TABLE public.nfl_plays RENAME COLUMN off_personnel_wr_count_pp TO off_personnel_wr_count_per_play;
ALTER TABLE public.nfl_plays RENAME COLUMN pass_oe TO pass_over_expected;
ALTER TABLE public.nfl_plays RENAME COLUMN player_fuml_gsis TO fumble_lost_gsis_player_id;
ALTER TABLE public.nfl_plays RENAME COLUMN player_fuml_pid TO fumble_lost_pid;
ALTER TABLE public.nfl_plays RENAME COLUMN pos_to_rem TO pos_timeouts_remaining;
ALTER TABLE public.nfl_plays RENAME COLUMN psr_gsis TO passer_gsis_player_id;
ALTER TABLE public.nfl_plays RENAME COLUMN ret_tm TO return_nfl_team;
ALTER TABLE public.nfl_plays RENAME COLUMN ret_yds TO return_yds;
ALTER TABLE public.nfl_plays RENAME COLUMN score_diff TO score_difference;
ALTER TABLE public.nfl_plays RENAME COLUMN score_diff_post TO score_difference_post;
ALTER TABLE public.nfl_plays RENAME COLUMN sec_rem_gm TO seconds_remaining_game;
ALTER TABLE public.nfl_plays RENAME COLUMN sec_rem_half TO seconds_remaining_half;
ALTER TABLE public.nfl_plays RENAME COLUMN sec_rem_qtr TO seconds_remaining_quarter;
ALTER TABLE public.nfl_plays RENAME COLUMN series_seq TO series_sequence;
ALTER TABLE public.nfl_plays RENAME COLUMN td_tm TO td_nfl_team;
ALTER TABLE public.nfl_plays RENAME COLUMN tp_result TO two_point_result;
ALTER TABLE public.nfl_plays RENAME COLUMN trg_gsis TO target_gsis_player_id;
ALTER TABLE public.nfl_plays RENAME COLUMN two_conv_prob TO two_conversion_prob;
ALTER TABLE public.nfl_plays RENAME COLUMN vegas_home_wp TO vegas_home_win_probability;
ALTER TABLE public.nfl_plays RENAME COLUMN vegas_wp TO vegas_win_probability;
ALTER TABLE public.nfl_plays RENAME COLUMN xyac_fd_prob TO xyac_first_down_prob;
ALTER TABLE public.nfl_plays RENAME COLUMN xyac_succ_prob TO xyac_success_prob;
ALTER TABLE public.nfl_plays RENAME COLUMN ydl_100 TO yard_line_100;
ALTER TABLE public.nfl_plays RENAME COLUMN ydl_end TO yard_line_end;
ALTER TABLE public.nfl_plays RENAME COLUMN ydl_num TO yard_line_num;
ALTER TABLE public.nfl_plays RENAME COLUMN ydl_side TO yard_line_side;
ALTER TABLE public.nfl_plays RENAME COLUMN ydl_start TO yard_line_start;

ALTER TABLE public.nfl_plays_current_week RENAME COLUMN away_to_rem TO away_timeouts_remaining;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN away_wp TO away_win_probability;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN away_wp_post TO away_win_probability_post;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN bc_gsis TO ball_carrier_gsis_player_id;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN def_to_rem TO def_timeouts_remaining;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN drive_end_qtr TO drive_end_quarter;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN drive_end_ydl TO drive_end_yard_line;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN drive_fds TO drive_first_downs;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN drive_seq TO drive_sequence;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN drive_start_qtr TO drive_start_quarter;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN drive_start_ydl TO drive_start_yard_line;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN home_to_rem TO home_timeouts_remaining;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN home_wp TO home_win_probability;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN home_wp_post TO home_win_probability_post;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN intp_gsis TO interceptor_gsis_player_id;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN n_offense_backfield TO number_offense_backfield;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN off_personnel_rb_count_pp TO off_personnel_rb_count_per_play;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN off_personnel_te_count_pp TO off_personnel_te_count_per_play;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN off_personnel_wr_count_pp TO off_personnel_wr_count_per_play;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN pass_oe TO pass_over_expected;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN player_fuml_gsis TO fumble_lost_gsis_player_id;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN player_fuml_pid TO fumble_lost_pid;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN pos_to_rem TO pos_timeouts_remaining;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN psr_gsis TO passer_gsis_player_id;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN ret_tm TO return_nfl_team;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN ret_yds TO return_yds;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN score_diff TO score_difference;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN score_diff_post TO score_difference_post;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN sec_rem_gm TO seconds_remaining_game;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN sec_rem_half TO seconds_remaining_half;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN sec_rem_qtr TO seconds_remaining_quarter;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN series_seq TO series_sequence;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN td_tm TO td_nfl_team;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN tp_result TO two_point_result;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN trg_gsis TO target_gsis_player_id;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN two_conv_prob TO two_conversion_prob;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN vegas_home_wp TO vegas_home_win_probability;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN vegas_wp TO vegas_win_probability;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN xyac_fd_prob TO xyac_first_down_prob;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN xyac_succ_prob TO xyac_success_prob;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN ydl_100 TO yard_line_100;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN ydl_end TO yard_line_end;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN ydl_num TO yard_line_num;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN ydl_side TO yard_line_side;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN ydl_start TO yard_line_start;
