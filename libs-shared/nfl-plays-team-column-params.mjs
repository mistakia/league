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
  }
}
