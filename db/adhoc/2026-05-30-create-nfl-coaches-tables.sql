-- Create nfl_coaches dimension + nfl_game_coaches game-team bridge.
--
-- Coaching attribution (head coach, offensive play-caller, defensive
-- play-caller) is ingested from samhoppen/NFL_public by
-- scripts/import-nfl-coaches.mjs. nfl_coaches is keyed by stable
-- Pro-Football-Reference coach IDs; nfl_game_coaches captures
-- mid-season firings at game-team grain.
--
-- nfl_games.{home,away}_play_caller continue to hold denormalized
-- coach name strings (varchar(36)) written by the new importer.
-- nfl_games.{home,away}_coach remain owned by
-- scripts/import-nfl-games-nflverse-nfldata.mjs and are unchanged.

CREATE TABLE nfl_coaches (
  pfr_coach_id varchar(16) PRIMARY KEY,
  full_name    varchar(80) NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE nfl_game_coaches (
  nflverse_game_id          varchar(15) NOT NULL,
  team                      varchar(3)  NOT NULL,
  head_coach_pfr_id         varchar(16) REFERENCES nfl_coaches(pfr_coach_id),
  off_play_caller_pfr_id    varchar(16) REFERENCES nfl_coaches(pfr_coach_id),
  def_play_caller_pfr_id    varchar(16) REFERENCES nfl_coaches(pfr_coach_id),
  ingested_at               timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (nflverse_game_id, team)
);

CREATE INDEX nfl_game_coaches_team ON nfl_game_coaches(team);
