import * as table_constants from 'react-table/src/constants.mjs'

import { bookmaker_constants, common_column_params } from '#libs-shared'
import COLUMN_GROUPS from './column-groups.js'
import { current_season } from '#constants'

const { career_year, career_game, single_year, single_nfl_week_id } =
  common_column_params

const from_betting_market = (field) => ({
  data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
  size: 70,
  // A null here means the bookmaker posted NO market for this player and week,
  // which is not the same claim as "the market settled at zero". The week-grain
  // participation renderer turns a null into 0 for an active player, because
  // for a counting STAT that reads correctly (played, recorded none) — applied
  // to a market it manufactures a line nobody ever offered. FanDuel has never
  // posted GAME_RUSHING_TOUCHDOWNS at all, and that column rendered 0.0 on
  // every row of every week rather than showing as absent.
  null_means_no_source: true,
  ...field
})

// market_type is a `single` SELECT, so it is stored as a one-element list;
// read it as a scalar wherever a sibling param branches on it.
const get_market_type_value = (params) =>
  Array.isArray(params.market_type) ? params.market_type[0] : params.market_type

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
    values: ['OVER', 'UNDER', 'YES', 'NO'],
    default_value: 'OVER',
    // Which selections EXIST depends on the market. A yes/no market
    // (ANYTIME_TOUCHDOWN and its four siblings) stores its selections as
    // YES/NO and holds no OVER row at all, so an OVER selection there is not a
    // narrower filter — it is a combination the database can never answer, and
    // the column comes back null on every row. Declaring the admissible set
    // keeps the control from OFFERING the impossible value, and the editor's
    // re-resolution repairs a column whose market_type changed under a
    // selection_type that was correct for the old one.
    get_values: (params) =>
      bookmaker_constants.yes_no_market_types.has(get_market_type_value(params))
        ? ['YES', 'NO']
        : ['OVER', 'UNDER'],
    // Dynamic default based on market_type - YES/NO markets use YES, stat markets use OVER
    get_default_value: (params) =>
      bookmaker_constants.yes_no_market_types.has(get_market_type_value(params))
        ? 'YES'
        : 'OVER'
  },
  time_type: {
    label: 'Time Type',
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    values: ['OPEN', 'CLOSE'],
    default_value: 'CLOSE',
    single: true
  },
  single_nfl_week_id
})

const player_market_type_param = {
  label: 'Market',
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  values: Object.values(bookmaker_constants.player_game_prop_types),
  default_value: bookmaker_constants.player_game_prop_types.GAME_PASSING_YARDS,
  single: true
}

const create_game_prop_column_params = () => ({
  ...create_base_column_params(),
  market_type: player_market_type_param,
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

const create_historical_game_prop_column_params = () => ({
  ...create_base_column_params(),
  market_type: player_market_type_param,
  hit_type: {
    label: 'Hit Type',
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    values: ['HARD', 'SOFT'],
    default_value: 'HARD',
    single: true
  },
  historical_range: {
    label: 'Historical Range',
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    values: [
      'CURRENT_SEASON',
      'LAST_FIVE',
      'LAST_TEN',
      'LAST_SEASON',
      'OVERALL'
    ],
    default_value: 'CURRENT_SEASON',
    single: true
  }
})

// The axis picker offers the UNION of row_axes over the selected columns and
// hides itself entirely when no column declares any, so a props-only view had
// no Splits control at all -- not even week, which every game-grain betting
// column has supported and been fixture-covered for on the server all along.
// A weekly props view was reachable only by hand-writing row_axes into the URL.
//
// Game grain only. The season prop below declares year alone: its line is one
// value for the whole season, so week is not a split it can offer. It still
// renders correctly if a game-grain column in the same view brings week in --
// the season line simply repeats down the weeks.
const GAME_GRAIN_ROW_AXES = ['year', 'week']

// The line axis splits a row across the RUNGS of a ladder market, and only a
// ladder market has any: a standard market posts one selection per player-game,
// so there is nothing to spread the row along and the server refuses the
// request outright. Which axes a column can offer therefore depends on the
// instance's market_type, not on its column id, so this is a function of the
// params — react-table resolves it per column instance.
//
// Same reason selection_type narrows its values off market_type above: do not
// offer a combination the database cannot answer. Here the stakes are higher,
// because a refused request renders as one generic banner with the server's
// message dropped, so a user who picks an impossible split sees no cause.
//
// Player game props only. A team market is not in the axis domain at all — the
// server's source resolution filters on is_player_game_prop — so a team column
// contributes no rungs whatever market_type it names.
const game_prop_row_axes = (params) =>
  bookmaker_constants.ladder_market_types.has(get_market_type_value(params))
    ? [...GAME_GRAIN_ROW_AXES, 'line']
    : GAME_GRAIN_ROW_AXES

// What THIS column's line-axis rows are values OF, so the picker can tell that
// two columns both offering `line` mean different things by it. The axis keys
// each row on the raw line value, so a row labelled 49.5 would put "49.5
// receiving yards" beside "49.5 receptions" as though they were one bet at one
// price. The server refuses that outright (validate-line-axis-columns.mjs);
// declaring the domain is what stops the picker OFFERING it in the first place,
// which is where the two views that shipped this way were composed.
//
// Ladder markets only, and the omission is load-bearing rather than a gap: a
// single-line market posts one selection per player-game, contributes no rungs,
// and is a legitimate neighbour of a ladder. Naming a domain for it would make
// it count as a second quantity and refuse views that work. Same rule, same
// reason, as the server's line-axis-sources.mjs.
const game_prop_row_axis_domain = (params) =>
  bookmaker_constants.ladder_market_types.has(get_market_type_value(params))
    ? { line: get_market_type_value(params) }
    : {}

const create_field =
  (
    column_groups,
    column_params,
    row_axes = GAME_GRAIN_ROW_AXES,
    row_axis_domain
  ) =>
  ({ column_title, header_label, player_value_path }) =>
    from_betting_market({
      column_title,
      header_label,
      player_value_path,
      column_groups,
      column_params,
      row_axes,
      row_axis_domain
    })

const create_game_prop_field = create_field(
  [COLUMN_GROUPS.BETTING_MARKETS, COLUMN_GROUPS.PLAYER_GAME_PROPS],
  create_game_prop_column_params(),
  game_prop_row_axes,
  game_prop_row_axis_domain
)

const create_historical_prop_field = create_field(
  [COLUMN_GROUPS.BETTING_MARKETS, COLUMN_GROUPS.PLAYER_GAME_PROPS],
  create_historical_game_prop_column_params(),
  game_prop_row_axes,
  game_prop_row_axis_domain
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
    row_axes: ['year'],
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
        default_value: current_season.year,
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

  player_game_prop_historical_hit_rate: create_historical_prop_field({
    column_title: 'Prop Historical Hit Rate',
    header_label: 'HIT RATE',
    player_value_path: 'prop_historical_hit_rate'
  }),

  player_game_prop_historical_edge: create_historical_prop_field({
    column_title: 'Prop Historical Edge',
    header_label: 'EDGE',
    player_value_path: 'prop_historical_edge'
  }),

  team_game_prop_line_from_betting_markets: create_team_game_prop_field({
    column_title: 'Team Game Prop Line',
    header_label: 'LINE',
    player_value_path: 'team_game_prop_line_betting_market'
  }),

  team_game_prop_american_odds_from_betting_markets:
    create_team_game_prop_field({
      column_title: 'Team Game Prop American Odds',
      header_label: 'ODDS',
      player_value_path: 'team_game_prop_american_odds_betting_market'
    }),

  team_game_prop_decimal_odds_from_betting_markets: create_team_game_prop_field(
    {
      column_title: 'Team Game Prop Decimal Odds',
      header_label: 'ODDS',
      player_value_path: 'team_game_prop_decimal_odds_betting_market'
    }
  ),

  team_game_implied_team_total_from_betting_markets:
    create_team_game_implied_total_field({
      column_title: 'Team Game Implied Total',
      header_label: 'TOTAL',
      player_value_path: 'team_game_implied_team_total_betting_market'
    })
}
