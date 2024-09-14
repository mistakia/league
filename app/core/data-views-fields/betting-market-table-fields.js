import * as table_constants from 'react-table/src/constants.mjs'

import { bookmaker_constants } from '#libs-shared'
import COLUMN_GROUPS from './column-groups'
import { constants, common_column_params } from '@libs-shared'

const { career_year, career_game, single_year, single_week } =
  common_column_params

const from_betting_market = (field) => ({
  data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
  size: 70,
  ...field
})

const create_base_column_params = () => ({
  source_id: {
    label: 'Bookmaker',
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    values: [
      bookmaker_constants.bookmakers.FANDUEL,
      bookmaker_constants.bookmakers.DRAFTKINGS,
      bookmaker_constants.bookmakers.PINNACLE,
      bookmaker_constants.bookmakers.PRIZEPICKS
    ],
    default_value: bookmaker_constants.bookmakers.FANDUEL,
    single: true
  },
  selection_type: {
    label: 'Selection Type',
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    values: ['OVER', 'UNDER', 'YES', 'NO']
  },
  time_type: {
    label: 'Time Type',
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    values: ['OPEN', 'CLOSE'],
    default_value: 'CLOSE',
    single: true
  },
  year: {
    ...single_year,
    default_value: constants.year,
    values: [2023, 2024]
  },
  week: single_week
})

const create_game_prop_column_params = () => ({
  ...create_base_column_params(),
  market_type: {
    label: 'Market',
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    values: Object.values(bookmaker_constants.player_game_prop_types),
    default_value:
      bookmaker_constants.player_game_prop_types.GAME_PASSING_YARDS,
    single: true
  },
  career_year,
  career_game
})

const create_team_game_prop_column_params = () => ({
  ...create_base_column_params(),
  market_type: {
    label: 'Market',
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    values: Object.values(bookmaker_constants.team_game_market_types),
    default_value: bookmaker_constants.team_game_market_types.GAME_TOTAL,
    single: true
  }
})

const create_field =
  (column_groups, column_params) =>
  ({ column_title, header_label, player_value_path }) =>
    from_betting_market({
      column_title,
      header_label,
      player_value_path,
      column_groups,
      column_params
    })

const create_game_prop_field = create_field(
  [COLUMN_GROUPS.BETTING_MARKETS, COLUMN_GROUPS.PLAYER_GAME_PROPS],
  create_game_prop_column_params()
)

const create_team_game_prop_field = create_field(
  [COLUMN_GROUPS.BETTING_MARKETS, COLUMN_GROUPS.TEAM_GAME_PROPS],
  create_team_game_prop_column_params()
)

const create_team_game_implied_total_field = create_field(
  [COLUMN_GROUPS.BETTING_MARKETS, COLUMN_GROUPS.TEAM_GAME_PROPS],
  create_base_column_params()
)

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
        ...single_year,
        default_value: constants.year,
        values: [2023, 2024]
      },
      career_year
    }
  }),

  player_game_prop_line_from_betting_markets: create_game_prop_field({
    column_title: 'Game Prop Line',
    header_label: 'LINE',
    player_value_path: 'game_prop_line_betting_market'
  }),

  player_game_prop_american_odds_from_betting_markets: create_game_prop_field({
    column_title: 'Game Prop American Odds',
    header_label: 'ODDS',
    player_value_path: 'game_prop_american_odds_betting_market'
  }),

  player_game_prop_decimal_odds_from_betting_markets: create_game_prop_field({
    column_title: 'Game Prop Decimal Odds',
    header_label: 'ODDS',
    player_value_path: 'game_prop_decimal_odds_betting_market'
  }),

  player_game_prop_implied_probability_from_betting_markets:
    create_game_prop_field({
      column_title: 'Game Prop Implied Probability',
      header_label: 'PROB',
      player_value_path: 'game_prop_implied_probability_betting_market'
    }),

  team_game_prop_line_from_betting_markets: create_team_game_prop_field({
    column_title: 'Team Game Prop Line',
    header_label: 'LINE',
    player_value_path: 'team_game_prop_line_betting_market'
  }),

  team_game_prop_odds_from_betting_markets: create_team_game_prop_field({
    column_title: 'Team Game Prop Odds',
    header_label: 'ODDS',
    player_value_path: 'team_game_prop_odds_betting_market'
  }),

  team_game_implied_team_total_from_betting_markets:
    create_team_game_implied_total_field({
      column_title: 'Team Game Implied Total',
      header_label: 'TOTAL',
      player_value_path: 'team_game_implied_team_total_betting_market'
    })
}
