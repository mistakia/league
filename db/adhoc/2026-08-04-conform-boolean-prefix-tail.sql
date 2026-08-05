-- STATUS: APPLIED 2026-08-05 against league_production
--
-- Boolean-prefix conformance: the remaining tables
--
-- Retires 58 of the 249 boolean_prefix violations reported by
-- db/adhoc/audit-schema-conformance.mjs at ruler league cb578d8e7.
--
-- Every column renamed here was verified to be data_type = 'boolean' in
-- information_schema before the map was authored; the audit infers
-- boolean-ness from the dump and a false positive would rename a
-- non-boolean column.
--
-- Spread thin across 31 tables, none partitioned.
--
-- Source of truth for the mapping:
--   scratch/league/schema-redesign/boolean-prefix-rename-map.json
-- Regenerate this file with:
--   node scratch/league/schema-redesign/build-boolean-prefix-ddl.mjs

BEGIN;

-- dfs_contests (1)
ALTER TABLE public.dfs_contests RENAME COLUMN ownership_imported TO is_ownership_imported;

-- draft (1)
ALTER TABLE public.draft RENAME COLUMN comp TO is_compensatory;

-- external_league_connections (1)
ALTER TABLE public.external_league_connections RENAME COLUMN auto_sync_enabled TO is_auto_sync_enabled;

-- external_league_import_job_history (1)
ALTER TABLE public.external_league_import_job_history RENAME COLUMN success TO is_successful;

-- external_league_import_jobs (1)
ALTER TABLE public.external_league_import_jobs RENAME COLUMN dry_run TO is_dry_run;

-- historical_injury_index (8)
ALTER TABLE public.historical_injury_index RENAME COLUMN changelog_injury_event TO has_changelog_injury_event;
ALTER TABLE public.historical_injury_index RENAME COLUMN changelog_nfl_reserve_event TO has_changelog_nfl_reserve_event;
ALTER TABLE public.historical_injury_index RENAME COLUMN changelog_unavailable TO is_changelog_unavailable;
ALTER TABLE public.historical_injury_index RENAME COLUMN gamelog_active TO is_gamelog_active;
ALTER TABLE public.historical_injury_index RENAME COLUMN played TO is_played;
ALTER TABLE public.historical_injury_index RENAME COLUMN practice_listed_injury TO has_practice_listed_injury;
ALTER TABLE public.historical_injury_index RENAME COLUMN practice_questionable_or_worse TO is_practice_questionable_or_worse;
ALTER TABLE public.historical_injury_index RENAME COLUMN ruled_out_in_game TO is_ruled_out_in_game;

-- jobs (1)
ALTER TABLE public.jobs RENAME COLUMN succ TO is_successful;

-- league_format_player_projection_values_history (1)
ALTER TABLE public.league_format_player_projection_values_history RENAME COLUMN removed TO is_removed;

-- league_scoring_formats (1)
ALTER TABLE public.league_scoring_formats RENAME COLUMN exclude_quarterback_kneels TO is_excluding_quarterback_kneels;

-- league_team_lineup_contribution_weeks (1)
ALTER TABLE public.league_team_lineup_contribution_weeks RENAME COLUMN start TO is_starter;

-- leagues (1)
ALTER TABLE public.leagues RENAME COLUMN hosted TO is_hosted;

-- nfl_games (2)
ALTER TABLE public.nfl_games RENAME COLUMN div TO is_division_game;
ALTER TABLE public.nfl_games RENAME COLUMN ot TO is_overtime;

-- nfl_play_stats (1)
ALTER TABLE public.nfl_play_stats RENAME COLUMN valid TO is_valid;

-- nfl_play_stats_current_week (1)
ALTER TABLE public.nfl_play_stats_current_week RENAME COLUMN valid TO is_valid;

-- nfl_plays_passer (5)
ALTER TABLE public.nfl_plays_passer RENAME COLUMN hurry TO is_hurry;
ALTER TABLE public.nfl_plays_passer RENAME COLUMN pass_dropped TO is_pass_dropped;
ALTER TABLE public.nfl_plays_passer RENAME COLUMN pressure TO is_pressure;
ALTER TABLE public.nfl_plays_passer RENAME COLUMN pressure_at_pass_forward TO is_pressure_at_pass_forward;
ALTER TABLE public.nfl_plays_passer RENAME COLUMN spike TO is_spike;

-- nfl_plays_player (6)
ALTER TABLE public.nfl_plays_player RENAME COLUMN caused_pressure TO has_caused_pressure;
ALTER TABLE public.nfl_plays_player RENAME COLUMN lined_up_in_the_box TO is_lined_up_in_the_box;
ALTER TABLE public.nfl_plays_player RENAME COLUMN pass_defended TO is_pass_defended;
ALTER TABLE public.nfl_plays_player RENAME COLUMN pressure_caused_turnover TO has_pressure_caused_turnover;
ALTER TABLE public.nfl_plays_player RENAME COLUMN was_blitzing TO is_blitzing;
ALTER TABLE public.nfl_plays_player RENAME COLUMN was_running_route TO is_running_route;

-- nfl_plays_receiver (5)
ALTER TABLE public.nfl_plays_receiver RENAME COLUMN completion TO is_completion;
ALTER TABLE public.nfl_plays_receiver RENAME COLUMN interception TO is_interception;
ALTER TABLE public.nfl_plays_receiver RENAME COLUMN isolated TO is_isolated;
ALTER TABLE public.nfl_plays_receiver RENAME COLUMN pass_dropped TO is_pass_dropped;
ALTER TABLE public.nfl_plays_receiver RENAME COLUMN touchdown TO is_touchdown;

-- nfl_plays_rusher (1)
ALTER TABLE public.nfl_plays_rusher RENAME COLUMN touchdown TO is_touchdown;

-- pff_player_seasonlogs (1)
ALTER TABLE public.pff_player_seasonlogs RENAME COLUMN meets_snap_minimum TO is_meeting_snap_minimum;

-- player (1)
ALTER TABLE public.player RENAME COLUMN combine_attendance TO has_combine_attendance;

-- player_gamelogs (3)
ALTER TABLE public.player_gamelogs RENAME COLUMN active TO is_active;
ALTER TABLE public.player_gamelogs RENAME COLUMN ruled_out_in_game TO is_ruled_out_in_game;
ALTER TABLE public.player_gamelogs RENAME COLUMN started TO is_starter;

-- poaches (1)
ALTER TABLE public.poaches RENAME COLUMN succ TO is_successful;

-- prop_markets_history (2)
ALTER TABLE public.prop_markets_history RENAME COLUMN live TO is_live;
ALTER TABLE public.prop_markets_history RENAME COLUMN open TO is_open;

-- prop_markets_index (3)
ALTER TABLE public.prop_markets_index RENAME COLUMN live TO is_live;
ALTER TABLE public.prop_markets_index RENAME COLUMN market_settled TO is_market_settled;
ALTER TABLE public.prop_markets_index RENAME COLUMN open TO is_open;

-- props (2)
ALTER TABLE public.props RENAME COLUMN active TO is_active;
ALTER TABLE public.props RENAME COLUMN live TO is_live;

-- restricted_free_agency_bids (1)
ALTER TABLE public.restricted_free_agency_bids RENAME COLUMN succ TO is_successful;

-- roster_asset_holding (1)
ALTER TABLE public.roster_asset_holding RENAME COLUMN audit_corrected TO is_audit_corrected;

-- roster_asset_transformation (1)
ALTER TABLE public.roster_asset_transformation RENAME COLUMN audit_corrected TO is_audit_corrected;

-- seasons (1)
ALTER TABLE public.seasons RENAME COLUMN free_agency_auction_slow_mode TO is_free_agency_auction_slow_mode;

-- selection_combination_definitions (1)
ALTER TABLE public.selection_combination_definitions RENAME COLUMN active TO is_active;

-- waivers (1)
ALTER TABLE public.waivers RENAME COLUMN succ TO is_successful;

-- external_league_import_job_history.success -> is_successful inside
-- archive_completed_import_jobs(). The rename above does not reach into the
-- function body; without this the next archive run fails with
-- `column "success" of relation "external_league_import_job_history" does not exist`.
CREATE OR REPLACE FUNCTION public.archive_completed_import_jobs() RETURNS integer
    LANGUAGE plpgsql
    AS $function$
DECLARE
  archived_count INTEGER := 0;
  job_record RECORD;
BEGIN
  -- Archive jobs older than 30 days that are completed or failed
  FOR job_record IN
    SELECT * FROM external_league_import_jobs
    WHERE status IN ('completed', 'failed', 'cancelled')
      AND completed_at < NOW() - INTERVAL '30 days'
  LOOP
    -- Insert into history table
    INSERT INTO external_league_import_job_history (
      job_id, connection_id, lid, job_type, status,
      queued_at, started_at, completed_at,
      duration_seconds,
      is_successful, players_mapped, rosters_updated, transactions_imported,
      error_summary, initiated_by
    ) VALUES (
      job_record.job_id, job_record.connection_id, job_record.lid,
      job_record.job_type, job_record.status,
      job_record.queued_at, job_record.started_at, job_record.completed_at,
      CASE
        WHEN job_record.started_at IS NOT NULL AND job_record.completed_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (job_record.completed_at - job_record.started_at))::INTEGER
        ELSE NULL
      END,
      job_record.status = 'completed',
      job_record.players_mapped, job_record.rosters_updated, job_record.transactions_imported,
      job_record.error_message, job_record.initiated_by
    );

    -- Delete from main table
    DELETE FROM external_league_import_jobs WHERE job_id = job_record.job_id;
    archived_count := archived_count + 1;
  END LOOP;

  RETURN archived_count;
END;
$function$;

COMMIT;
