-- STATUS: APPLIED 2026-08-02 against league_production
--
-- `league_team_daily_values.ktc_share` is a fraction of a day's league-wide
-- keeptradecut total, so 1.0 is a legitimate value: it is what a league emits on
-- any day where a single team holds all the ranked value. `numeric(5,5)` is five
-- digits with five of them after the point, which caps the column at 0.99999 and
-- makes exactly that day a `numeric field overflow` — an error that aborts the
-- whole upsert and takes `calculate-team-daily-ktc-value` down with it.
--
-- League 1's current maximum share is 0.52125 across 12 teams, so nothing in
-- production has reached the ceiling; the exposure is a small league, a league
-- shrinking toward one valued team, or the inception window before most rosters
-- carry a ranked player.
--
-- `numeric(6,5)` keeps the same five decimal places and adds one integer digit,
-- so every stored value is preserved exactly and 1.00000 becomes representable.

ALTER TABLE public.league_team_daily_values
  ALTER COLUMN ktc_share TYPE numeric(6, 5);
