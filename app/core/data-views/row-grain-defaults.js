// Per-row-grain defaults applied when the user toggles row_grain. Mirrors
// libs-server/data-views/row-grains/{player,team}.mjs -- when those change,
// update here too. The client coverage spec asserts the prefix_columns
// listed here resolve in data_views_fields.

export const ROW_GRAIN_DEFAULTS = {
  player: {
    prefix_columns: ['player_name', 'player_nfl_teams', 'player_position']
  },
  team: {
    prefix_columns: ['team_code', 'team_name']
  }
}

export const ROW_GRAIN_OPTIONS = [
  { value: 'player', label: 'Player' },
  { value: 'team', label: 'Team' }
]

export const ROW_GRAIN_TOOLTIP =
  'What each row in the table represents. Switching prunes columns, filters, and sorts to those compatible with the selected grain.'
