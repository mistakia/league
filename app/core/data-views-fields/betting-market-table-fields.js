import * as table_constants from 'react-table/src/constants.mjs'

import { bookmaker_constants } from '#libs-shared'
import COLUMN_GROUPS from './column-groups'
import { constants, common_column_params } from '@libs-shared'

const { career_year, career_game } = common_column_params

const from_betting_market = (field) => ({
  data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
  size: 70,
  ...field
})

export default {
  player_season_prop_line_from_betting_markets: from_betting_market({
    column_title: 'Season Prop Line',
    header_label: 'LINE',
    player_value_path: 'season_prop_line_betting_market',
    column_groups: [COLUMN_GROUPS.BETTING_MARKETS, COLUMN_GROUPS.SEASON_PROPS],
    column_params: {
      market_type: {
        label: 'Market',
        data_type: table_constants.TABLE_DATA_TYPES.SELECT,
        values: Object.values(bookmaker_constants.player_season_prop_types),
        default_value:
          bookmaker_constants.player_season_prop_types.SEASON_PASSING_YARDS,
        single: true
      },
      source_id: {
        label: 'Bookmaker',
        data_type: table_constants.TABLE_DATA_TYPES.SELECT,
        values: [bookmaker_constants.bookmakers.FANDUEL],
        default_value: bookmaker_constants.bookmakers.FANDUEL,
        single: true
      },
      year: {
        data_type: table_constants.TABLE_DATA_TYPES.SELECT,
        values: [2023, 2024],
        default_value: 2024,
        single: true,
        enable_multi_on_split: ['year']
      },
      career_year
    }
  }),

  player_game_prop_line_from_betting_markets: from_betting_market({
    column_title: 'Game Prop Line',
    header_label: 'LINE',
    player_value_path: 'game_prop_line_betting_market',
    column_groups: [COLUMN_GROUPS.BETTING_MARKETS, COLUMN_GROUPS.GAME_PROPS],
    column_params: {
      market_type: {
        label: 'Market',
        data_type: table_constants.TABLE_DATA_TYPES.SELECT,
        values: Object.values(bookmaker_constants.player_game_prop_types),
        default_value:
          bookmaker_constants.player_game_prop_types.GAME_PASSING_YARDS,
        single: true
      },
      source_id: {
        label: 'Bookmaker',
        data_type: table_constants.TABLE_DATA_TYPES.SELECT,
        values: [bookmaker_constants.bookmakers.FANDUEL],
        default_value: bookmaker_constants.bookmakers.FANDUEL,
        single: true
      },
      year: {
        data_type: table_constants.TABLE_DATA_TYPES.SELECT,
        values: [2023, 2024],
        default_value: 2024,
        single: true,
        enable_multi_on_split: ['year']
      },
      week: {
        data_type: table_constants.TABLE_DATA_TYPES.SELECT,
        values: constants.nfl_weeks,
        default_value: 1,
        single: true
      },
      career_year,
      career_game
    }
  })
}
