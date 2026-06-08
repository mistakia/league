-- Fix stale COMMENT on league_team_player_seasonlogs: replace league_format_hash
-- grain reference with league_format_id following the 2026-05-29 format-id migration.
COMMENT ON TABLE public.league_team_player_seasonlogs IS 'Per-player surplus-value contribution to a specific team in a specific season at (lid, tid, pid, year, league_format_id) grain. Salary attribution follows start-team-bears-cap: salary_paid carries the full league_player_seasonlogs.salary on the start-team row and 0 on subsequent holders. Trade-return value is computed downstream via trades_players joins.';
