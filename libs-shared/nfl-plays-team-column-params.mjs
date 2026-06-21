import * as table_constants from 'react-table/src/constants.mjs'

export default {
  team_unit: {
    label: 'Team Unit',
    default_value: 'off',
    values: [
      {
        label: 'Offense',
        value: 'off'
      },
      {
        label: 'Defense',
        value: 'def'
      }
    ],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    single: true
  },
  limit_to_player_active_games: {
    label: 'Include Only Player Active Games',
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  matchup_opponent_type: {
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    label: 'Use Opponent',
    single: true,
    values: [
      { label: "Player's Team", value: null },
      {
        label: 'Current Week Opponent',
        value: 'current_week_opponent_total'
      },
      { label: 'Next Week Opponent', value: 'next_week_opponent_total' }
    ]
  },
  // Which team a player-cell team RATE stat (per_game / per_team_play) attaches
  // to. 'historical' (default) routes through the player_year -> team_year bridge
  // (per-year team of record); 'current' attaches to player.current_nfl_team
  // (forward-looking projection). Inert on non-rate columns, which do not declare
  // the param server-side. See docs/data-views-system.md "Team-Scoped Joins".
  team_attribution: {
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    label: 'Team Attribution',
    single: true,
    default_value: 'historical',
    values: [
      { label: 'Historical (team of record)', value: 'historical' },
      { label: 'Current Team', value: 'current' }
    ]
  }
}
