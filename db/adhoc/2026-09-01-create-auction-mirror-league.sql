-- STATUS: APPLIED 2026-09-01 against league_production
--
-- Create the auction mirror: a hosted, read-write copy of league 1's settings,
-- so the election-mode interface can be walked before the real auction.
--
-- WHY A SECOND HOSTED LEAGUE. Everything a manager actually does in election
-- mode -- set a maximum, decline, watch the outstanding list shrink, see a
-- settlement land -- can only be exercised against a league you can write to.
-- League 1 IS the real auction, so it cannot be that league: a click there
-- writes a binding election. `is_hosted` means this platform manages the league
-- read-write, as against an external league mirrored read-only by
-- sync-external-league.mjs; it is not a batch-job visibility flag.
--
-- This creates the SHELL only -- the league row and its season row. The board
-- (teams, users_teams, rosters, rosters_players and the salary-bearing
-- transactions) is copied separately by `scripts/clone-league.mjs --sync`, which
-- is idempotent and re-runnable. Keeping them apart is deliberate: the shell is
-- created once and the board is re-synced whenever league 1 moves.
--
-- Settings are copied from league 1 rather than invented, so the mirror has the
-- same roster limits, cap, scoring and league format -- which is the whole point
-- of mirroring rather than seeding a synthetic league.
--
-- THREE DELIBERATE DIFFERENCES FROM LEAGUE 1:
--
--   1. Both Discord webhooks are NULL. The mirror must not be able to post to
--      the league's channels; a test settlement announcing itself to ten
--      managers is the failure this prevents.
--   2. The free agency period is OPEN NOW, where league 1's opens 2026-09-03.
--      Every auction surface gates on the period being open, so a mirror with
--      league 1's dates renders nothing and cannot be walked -- which is the
--      entire reason it exists.
--   3. is_auction_election_mode_enabled is TRUE. League 1's stays false until
--      the operator flips it; the mirror is where election mode is exercised.
--
-- Teardown is `leagues.archived_at`, not a delete, so the run stays auditable.

INSERT INTO public.leagues (
    name,
    is_hosted,
    discord_webhook_url,
    discord_announcements_webhook_url,
    commissioner_user_id,
    processed_at,
    espn_league_id,
    sleeper_league_id,
    mfl_league_id,
    fleaflicker_league_id,
    salary_attribution_rule
)
SELECT
    'GENESIS LEAGUE (auction mirror)',
    true,
    -- Explicitly NULL rather than inherited. league 1 carries both.
    NULL,
    NULL,
    commissioner_user_id,
    processed_at,
    -- External league ids are NOT copied: they identify league 1 at ESPN,
    -- Sleeper, MFL and Fleaflicker, and a second row claiming the same ids
    -- would make any importer ambiguous about which league it is filling.
    NULL,
    NULL,
    NULL,
    NULL,
    salary_attribution_rule
FROM public.leagues
WHERE league_id = 1;

INSERT INTO public.seasons (
    lid,
    free_agency_period_start,
    free_agency_period_end,
    season_year, season_started_at,
    franchise_tag_salary_quarterback, franchise_tag_salary_running_back,
    franchise_tag_salary_wide_receiver, franchise_tag_salary_tight_end,
    restricted_free_agency_period_start, restricted_free_agency_period_end,
    extension_deadline_at, draft_start, trade_deadline_at, draft_type,
    draft_hour_min, draft_hour_max,
    max_roster_quarterback, max_roster_running_back, max_roster_wide_receiver,
    max_roster_tight_end, max_roster_defense_special_teams, max_roster_kicker,
    starting_free_agent_acquisition_budget, franchise_tag_limit,
    rookie_tag_limit, restricted_free_agency_tag_limit, season_due_amount,
    wildcard_round, championship_round, rookie_draft_completed_at,
    season_finalized_at, scoring_format_id, league_format_id,
    restricted_free_agency_first_window_at, restricted_free_agency_window_hours,
    restricted_free_agency_processing_lead_hours, playoff_team_count,
    bye_count, bye_candidate_pool, bye_selection_method,
    at_large_selection_method, has_division_winner_berths,
    trade_veto_window_hours, draft_pick_interval,
    restricted_free_agency_processing_paused_until,
    restricted_free_agency_processing_paused_reason,
    restricted_free_agency_processing_paused_at,
    head_to_head_berth_count, rookie_draft_end_at,
    auction_block_notice_minutes, auction_final_block_pace_minutes,
    auction_final_block_buffer_hours, is_auction_election_mode_enabled
)
SELECT
    (SELECT max(league_id) FROM public.leagues),
    -- Open now, and running to league 1's own period end. The window
    -- inequality wants period_end - period_start to clear roughly 39 hours at
    -- this board's shape; from now to 2026-09-08T02:00Z is comfortably over it.
    now() - interval '1 hour',
    s.free_agency_period_end,
    s.season_year, s.season_started_at,
    s.franchise_tag_salary_quarterback, s.franchise_tag_salary_running_back,
    s.franchise_tag_salary_wide_receiver, s.franchise_tag_salary_tight_end,
    s.restricted_free_agency_period_start, s.restricted_free_agency_period_end,
    s.extension_deadline_at, s.draft_start, s.trade_deadline_at, s.draft_type,
    s.draft_hour_min, s.draft_hour_max,
    s.max_roster_quarterback, s.max_roster_running_back,
    s.max_roster_wide_receiver, s.max_roster_tight_end,
    s.max_roster_defense_special_teams, s.max_roster_kicker,
    s.starting_free_agent_acquisition_budget, s.franchise_tag_limit,
    s.rookie_tag_limit, s.restricted_free_agency_tag_limit, s.season_due_amount,
    s.wildcard_round, s.championship_round, s.rookie_draft_completed_at,
    s.season_finalized_at, s.scoring_format_id, s.league_format_id,
    s.restricted_free_agency_first_window_at,
    s.restricted_free_agency_window_hours,
    s.restricted_free_agency_processing_lead_hours, s.playoff_team_count,
    s.bye_count, s.bye_candidate_pool, s.bye_selection_method,
    s.at_large_selection_method, s.has_division_winner_berths,
    s.trade_veto_window_hours, s.draft_pick_interval,
    s.restricted_free_agency_processing_paused_until,
    s.restricted_free_agency_processing_paused_reason,
    s.restricted_free_agency_processing_paused_at,
    s.head_to_head_berth_count, s.rookie_draft_end_at,
    s.auction_block_notice_minutes, s.auction_final_block_pace_minutes,
    s.auction_final_block_buffer_hours,
    -- TRUE here, false on league 1. This is where election mode is exercised.
    true
FROM public.seasons s
WHERE s.lid = 1 AND s.season_year = 2026;
