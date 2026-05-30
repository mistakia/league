// Single source of truth for per-row-grain defaults.
//
// Consumed by:
//   - client: app/core/data-views/row-grain-defaults.js (re-export)
//   - server: libs-server/data-views/row-grains/{player,team}.mjs (prefix_columns)
//   - default views: app/core/data-views/default-data-views.js
//   - new-view seeding: app/views/pages/data-views/data-views.js

export const ROW_GRAIN_DEFAULTS = {
  player: {
    name: 'player',
    label: 'Player',
    prefix_columns: ['player_name', 'player_nfl_teams', 'player_position']
  },
  team: {
    name: 'team',
    label: 'Team',
    prefix_columns: ['team_code', 'team_name']
  }
}

export const ROW_GRAIN_OPTIONS = Object.values(ROW_GRAIN_DEFAULTS).map(
  ({ name, label }) => ({ value: name, label })
)

export const ROW_GRAIN_TOOLTIP =
  'What each row in the table represents. Switching prunes columns, filters, and sorts to those compatible with the selected grain.'
