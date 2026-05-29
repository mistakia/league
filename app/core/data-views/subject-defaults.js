// Per-subject defaults applied when the user toggles subject. Mirrors
// libs-server/data-views/subjects/{player,team}.mjs -- when those change,
// update here too. The client coverage spec asserts the prefix_columns
// listed here resolve in data_views_fields.

export const SUBJECT_DEFAULTS = {
  player: {
    prefix_columns: ['player_name', 'player_nfl_teams', 'player_position']
  },
  team: {
    prefix_columns: ['team_code', 'team_name']
  }
}

export const SUBJECT_OPTIONS = [
  { value: 'player', label: 'Player' },
  { value: 'team', label: 'Team' }
]
