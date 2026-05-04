-- Rename short-form PP/PPP/DOI columns to descriptive snake_case forms.
-- Tracking task: user:task/home-dynasty-league/league-operations/reimplement-potential-points-penalty.md
-- Constitutional basis: Article XI sections 2-3, Amendment XXVI.
-- Wrapped in a single transaction by yarn db:exec; either all renames apply or none do.

ALTER TABLE league_team_seasonlogs RENAME COLUMN pp     TO potential_points;
ALTER TABLE league_team_seasonlogs RENAME COLUMN ppp    TO potential_points_penalty;
ALTER TABLE league_team_seasonlogs RENAME COLUMN pp_pct TO potential_points_pct;
ALTER TABLE league_team_seasonlogs RENAME COLUMN doi    TO draft_order_index;

ALTER TABLE league_team_careerlogs RENAME COLUMN pp     TO potential_points;
ALTER TABLE league_team_careerlogs RENAME COLUMN pp_pct TO potential_points_pct;

ALTER TABLE league_user_careerlogs RENAME COLUMN pp     TO potential_points;
ALTER TABLE league_user_careerlogs RENAME COLUMN pp_pct TO potential_points_pct;
