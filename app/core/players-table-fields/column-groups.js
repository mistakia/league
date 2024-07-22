const COLUMN_GROUPS = {
  MEASURABLES: { priority: 1 },
  COLLEGE: { priority: 1 },
  NFL_TEAM: { priority: 1 },
  DRAFT: { priority: 1 },
  PROSPECT: { priority: 1 },
  BETTING_MARKETS: { priority: 1 },
  PROJECTION: { priority: 1 },
  ESPN: { priority: 1 },
  PLAYER_IDS: { priority: 1 },
  TEAM_STATS: { priority: 1 },
  KEEPTRADECUT: { priority: 1 },
  NFL: { priority: 2 },
  NGS: { priority: 2 },
  SEASON_PROPS: { priority: 2 },
  GAME_PROPS: { priority: 2 },
  WEEK_PROJECTION: { priority: 2 },
  SEASON_PROJECTION: { priority: 2 },
  REST_OF_SEASON_PROJECTION: { priority: 2 },
  FANTASY_POINTS: { priority: 3 },
  FANTASY_LEAGUE: { priority: 3 },
  OPPURTUNITY: { priority: 3 },
  PASSING: { priority: 3 },
  RUSHING: { priority: 3 },
  RECEIVING: { priority: 3 },
  TACKLES: { priority: 3 },
  ADVANCED: { priority: 3 },
  SEASON: { priority: 4 },
  CAREER: { priority: 4 },
  EFFICIENCY: { priority: 4 },
  AFTER_CATCH: { priority: 5 }
}

for (const [key, value] of Object.entries(COLUMN_GROUPS)) {
  value.column_group_id = key
}

export default COLUMN_GROUPS
