import React from 'react'
import { List } from 'immutable'
import { createSelector } from 'reselect'
import * as table_constants from 'react-table/src/constants.mjs'

import {
  constants,
  stat_in_year_week,
  nfl_plays_column_params
} from '@libs-shared'
import PlayerRowNameColumn from '@components/player-row-name-column'
import PlayerRowStatusColumn from '@components/player-row-status-column'
import PlayerRowNFLTeam from '@components/player-row-nfl-team'
import { bookmaker_constants } from '#libs-shared'

const COLUMN_GROUPS = {
  MEASURABLES: { priority: 1 },
  COLLEGE: { priority: 1 },
  NFL_TEAM: { priority: 1 },
  DRAFT: { priority: 1 },
  BETTING_MARKETS: { priority: 1 },
  PROJECTION: { priority: 1 },
  ESPN: { priority: 1 },
  SEASON_PROPS: { priority: 2 },
  GAME_PROPS: { priority: 2 },
  WEEK_PROJECTION: { priority: 2 },
  SEASON_PROJECTION: { priority: 2 },
  REST_OF_SEASON_PROJECTION: { priority: 2 },
  FANTASY_POINTS: { priority: 3 },
  FANTASY_LEAGUE: { priority: 3 },
  PASSING: { priority: 3 },
  RUSHING: { priority: 3 },
  RECEIVING: { priority: 3 },
  SEASON: { priority: 4 },
  CAREER: { priority: 4 },
  TOTALS: { priority: 4 },
  EFFICIENCY: { priority: 4 },
  AFTER_CATCH: { priority: 5 }
}

const active_year =
  constants.season.week > 0 ? constants.season.year : constants.season.year - 1

for (const [key, value] of Object.entries(COLUMN_GROUPS)) {
  value.column_group_id = key
}

function create_espn_score_field({ score_type, label }) {
  return {
    column_title: `ESPN ${label} Score`,
    column_groups: [COLUMN_GROUPS.ESPN, COLUMN_GROUPS.RECEIVING],
    header_label: label,
    player_value_path: `espn_${score_type}_score`,
    size: 70,
    data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
    column_params: {
      year: {
        values: [2023, 2022, 2021, 2020, 2019, 2018, 2017],
        data_type: table_constants.TABLE_DATA_TYPES.SELECT,
        single: true,
        default_value: 2023,
        enable_multi_on_split: ['year']
      },
      career_year: {
        data_type: table_constants.TABLE_DATA_TYPES.RANGE,
        min: 1,
        max: 25
      }
    },
    splits: ['year']
  }
}

// Player Column Fields
// header_label - string, required
// column_groups - array, optional

// load - optional

// component - optional
// header_className - optional

// getValue - optional
// player_value_path - optional

// getPercentileKey - optional
// percentile_key - optional
// percentile_field - optional

// fixed - optional

export const getPlayerTableFields = createSelector(
  (state) =>
    state.getIn(['players', 'week'], new List([constants.week])).get(0),
  (state) => state.getIn(['app', 'userId']),
  (week, userId) => PlayerTableFields({ week, is_logged_in: Boolean(userId) })
  // (state) => state.get('seasonlogs'),
  // (state) => state.getIn(['players', 'positions'], new List()),
  // (state) => state.getIn(['schedule', 'teams']),
  // (week, seasonlogs, player_positions, nfl_team_schedule) =>
  //   PlayerTableFields({ week, seasonlogs, player_positions, nfl_team_schedule })
)

export function PlayerTableFields({
  week,
  is_logged_in
  // seasonlogs,
  // player_positions,
  // nfl_team_schedule
}) {
  // const get_game_by_team = ({ nfl_team, week }) => {
  //   const team = nfl_team_schedule.get(nfl_team)
  //   if (!team) {
  //     return null
  //   }

  //   return team.games.find((g) => g.week === week)
  // }

  // const opponent_field = (stat_field) => {
  //   return {
  //     getPercentileKey: (playerMap) => {
  //       const pos = playerMap.get('pos')
  //       return `${pos}_AGAINST_ADJ`
  //     },
  //     fixed: 1,
  //     show_positivity: true,
  //     load: () => {
  //       player_positions.forEach((pos) => {
  //         const percentile_key = `${pos}_AGAINST_ADJ`
  //         store.dispatch(percentileActions.loadPercentiles(percentile_key))
  //       })
  //       store.dispatch(seasonlogsActions.load_nfl_team_seasonlogs())
  //     },
  //     getValue: (playerMap) => {
  //       const nfl_team = playerMap.get('team')
  //       const pos = playerMap.get('pos')
  //       const game = get_game_by_team({ nfl_team, week })
  //       if (!game) {
  //         return null
  //       }

  //       const isHome = game.h === nfl_team
  //       const opp = isHome ? game.v : game.h
  //       const value = seasonlogs.getIn(
  //         ['nfl_teams', opp, `${pos}_AGAINST_ADJ`, stat_field],
  //         0
  //       )

  //       return value
  //     }
  //   }
  // }

  const from_play_field = (field) => ({
    data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
    column_params: nfl_plays_column_params,
    size: 70,
    splits: ['year'],
    ...field
  })

  const from_format_player_logs = (field) => ({
    data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
    size: 70,
    ...field
  })

  const from_betting_market = (field) => ({
    data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
    size: 70,
    ...field
  })

  const scoring_format_hash_param = {
    label: 'Scoring Format',
    values: [
      {
        value:
          '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d',
        label: '0.5PPR / 4PTD / -1INT / 0.05PY / -1FUM (GENESIS LEAGUE)'
      },
      {
        value:
          'ad64bf40cdfec0a1ebdf66453fa57687832f7556f3870251c044d5d270fc089e',
        label: 'PPR / 4PTD / -1INT / -1FUM'
      }
    ],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    default_value:
      '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d',
    single: true
  }

  const league_format_hash_param = {
    label: 'League Format',
    values: [
      {
        value:
          '1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b',
        label: '10 Team / SFLEX / 1 FLX / 0.5PPR / 4PTD (GENESIS LEAGUE)'
      },
      {
        value:
          '97b8d7d2b53c7401b93bfad1fbe97aeb1a582e376b2fcb34868a8628d7fbe48a',
        label: '12 Team / SFLEX / 1 FLX / PPR / 4PTD'
      }
    ],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    default_value:
      '1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b',
    single: true
  }

  const from_scoring_format_seasonlogs = (field) => ({
    ...from_format_player_logs(field),
    column_groups: [COLUMN_GROUPS.FANTASY_POINTS, COLUMN_GROUPS.SEASON],
    column_params: {
      year: {
        values: constants.years,
        data_type: table_constants.TABLE_DATA_TYPES.SELECT,
        default_value: active_year,
        single: true,
        enable_multi_on_split: ['year']
      },
      scoring_format_hash: scoring_format_hash_param
    },
    splits: ['year']
  })

  const from_scoring_format_careerlogs = (field) => ({
    ...from_format_player_logs(field),
    column_groups: [COLUMN_GROUPS.FANTASY_POINTS, COLUMN_GROUPS.CAREER],
    column_params: {
      scoring_format_hash: scoring_format_hash_param
    }
  })

  const from_league_format_seasonlogs = (field) => ({
    ...from_format_player_logs(field),
    column_groups: [COLUMN_GROUPS.FANTASY_LEAGUE, COLUMN_GROUPS.SEASON],
    column_params: {
      year: {
        values: constants.years,
        data_type: table_constants.TABLE_DATA_TYPES.SELECT,
        default_value: active_year,
        single: true,
        enable_multi_on_split: ['year']
      },
      league_format_hash: league_format_hash_param
    },
    splits: ['year']
  })

  const from_league_format_careerlogs = (field) => ({
    ...from_format_player_logs(field),
    column_groups: [COLUMN_GROUPS.FANTASY_LEAGUE, COLUMN_GROUPS.CAREER],
    column_params: {
      league_format_hash: league_format_hash_param
    }
  })

  const fields = {
    player_name: {
      column_title: 'Full Name',
      header_label: 'Name',
      size:
        (window.innerWidth >= 601
          ? 200
          : window.innerWidth <= 400
            ? 100
            : 150) + (is_logged_in ? 30 : 0),
      component: React.memo(PlayerRowNameColumn),
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'name',
      sticky: true,
      accessorFn: ({ row }) => `${row.fname} ${row.lname}`
    },
    player_position: {
      column_title: 'Position',
      header_label: 'Pos',
      size: 50,
      data_type: table_constants.TABLE_DATA_TYPES.SELECT,
      column_values: constants.positions,
      player_value_path: 'pos',
      operators: [
        table_constants.TABLE_OPERATORS.IN,
        table_constants.TABLE_OPERATORS.NOT_IN
      ]
    },

    player_height: {
      column_title: 'Height',
      header_label: 'IN"',
      size: 50,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      player_value_path: 'height'
    },
    player_weight: {
      column_title: 'Weight',
      header_label: 'Lbs',
      size: 50,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      player_value_path: 'weight'
    },
    player_date_of_birth: {
      column_title: 'Date of Birth',
      header_label: 'DOB',
      size: 110,
      data_type: table_constants.TABLE_DATA_TYPES.DATE,
      player_value_path: 'dob'
    },
    player_age: {
      column_title: 'Current Age',
      header_label: 'Age',
      player_value_path: 'age',
      size: 60,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_forty_yard_dash: {
      column_title: '40 Yard Dash',
      header_label: 'Forty',
      size: 60,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.MEASURABLES],
      player_value_path: 'forty'
    },
    player_bench_press: {
      column_title: 'Bench Press',
      header_label: 'Bench',
      size: 50,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.MEASURABLES],
      player_value_path: 'bench'
    },
    player_vertical_jump: {
      column_title: 'Vertical Jump',
      header_label: 'Vert',
      size: 60,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.MEASURABLES],
      player_value_path: 'vertical'
    },
    player_broad_jump: {
      column_title: 'Broad Jump',
      header_label: 'Broad',
      size: 50,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.MEASURABLES],
      player_value_path: 'broad'
    },
    player_shuttle_run: {
      column_title: 'Shuttle Run',
      header_label: 'Shuttle',
      size: 60,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.MEASURABLES],
      player_value_path: 'shuttle'
    },
    player_three_cone_drill: {
      column_title: 'Three Cone Drill',
      header_label: '3 Cone',
      size: 60,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.MEASURABLES],
      player_value_path: 'cone'
    },
    player_arm_length: {
      column_title: 'Arm Length',
      header_label: 'Arm',
      size: 60,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.MEASURABLES],
      player_value_path: 'arm'
    },
    player_hand_size: {
      column_title: 'Hand Size',
      header_label: 'Hand',
      size: 60,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.MEASURABLES],
      player_value_path: 'hand'
    },
    player_draft_position: {
      column_title: 'Draft Position',
      header_label: 'Pos',
      size: 50,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.DRAFT],
      player_value_path: 'dpos'
    },
    player_draft_round: {
      column_title: 'Draft Round',
      header_label: 'Rd',
      size: 50,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.DRAFT],
      player_value_path: 'round'
    },
    player_college: {
      column_title: 'College',
      header_label: 'College',
      size: 150,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      column_groups: [COLUMN_GROUPS.COLLEGE],
      player_value_path: 'col'
    },
    player_college_division: {
      column_title: 'College Division',
      header_label: 'Div',
      size: 140,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      column_groups: [COLUMN_GROUPS.COLLEGE],
      player_value_path: 'dv'
    },
    player_starting_nfl_year: {
      column_title: 'Starting NFL Year',
      header_label: 'Year',
      size: 60,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.DRAFT],
      player_value_path: 'start'
    },
    player_current_nfl_team: {
      column_title: 'Current NFL Team',
      header_label: 'Team',
      size: 60,
      data_type: table_constants.TABLE_DATA_TYPES.SELECT,
      player_value_path: 'team',
      component: React.memo(PlayerRowNFLTeam),
      column_groups: [COLUMN_GROUPS.NFL_TEAM],
      operators: [
        table_constants.TABLE_OPERATORS.IN,
        table_constants.TABLE_OPERATORS.NOT_IN,
        table_constants.TABLE_OPERATORS.IS_NULL,
        table_constants.TABLE_OPERATORS.IS_NOT_NULL
      ],
      column_values: ['INA', ...constants.nflTeams]
    },
    player_position_depth: {
      column_title: 'Position Depth',
      header_label: 'Pos Depth',
      size: 50,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'posd',
      column_groups: [COLUMN_GROUPS.NFL_TEAM]
    },
    player_jersey_number: {
      column_title: 'Jersey Number',
      header_label: 'No.',
      size: 50,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      player_value_path: 'jnum',
      column_groups: [COLUMN_GROUPS.NFL_TEAM]
    },

    // opponent: {
    //   column_title: 'Opponent (NFL Team)',
    //   column_groups: [COLUMN_GROUPS.MATCHUP],
    //   header_label: 'Opponent',
    //   component: React.memo(PlayerRowOpponent),
    //   header_className: 'player__row-opponent',
    //   getValue: (playerMap) => {
    //     const nfl_team = playerMap.get('team')
    //     const game = get_game_by_team({ nfl_team, week })
    //     if (!game) {
    //       return null
    //     }

    //     const isHome = game.h === nfl_team
    //     const opp = isHome ? game.v : game.h
    //     return opp
    //   },
    //   data_type: table_constants.TABLE_DATA_TYPES.TEXT
    // },
    // opponent_strength: {
    //   column_title: 'Opponent Points Allowed Over Average (vs. Position)',
    //   column_groups: [COLUMN_GROUPS.MATCHUP],
    //   header_label: 'Strength',
    //   getPercentileKey: (playerMap) => {
    //     const pos = playerMap.get('pos')
    //     return `${pos}_AGAINST_ADJ`
    //   },
    //   percentile_field: 'pts',
    //   fixed: 1,
    //   show_positivity: true,
    //   load: () => {
    //     player_positions.forEach((pos) => {
    //       const percentile_key = `${pos}_AGAINST_ADJ`
    //       store.dispatch(percentileActions.loadPercentiles(percentile_key))
    //     })
    //     store.dispatch(seasonlogsActions.load_nfl_team_seasonlogs())
    //   },
    //   getValue: (playerMap) => {
    //     const nfl_team = playerMap.get('team')
    //     const pos = playerMap.get('pos')
    //     const game = get_game_by_team({ nfl_team, week })
    //     if (!game) {
    //       return null
    //     }

    //     const isHome = game.h === nfl_team
    //     const opp = isHome ? game.v : game.h
    //     const pts = seasonlogs.getIn(
    //       ['nfl_teams', opp, `${pos}_AGAINST_ADJ`, 'pts'],
    //       0
    //     )

    //     return pts
    //   },
    //   data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    // },

    player_rest_of_season_projected_points_added: {
      column_title: 'Projected Points Added (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.FANTASY_LEAGUE
      ],
      header_label: 'Pts+',
      player_value_path: stat_in_year_week('points_added')({
        params: { week: 'ros' }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_season_projected_points_added: {
      column_title: 'Projected Points Added (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.FANTASY_LEAGUE
      ],
      header_label: 'Pts+',
      player_value_path: stat_in_year_week('points_added')(),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_week_projected_points_added: {
      column_title: 'Projected Points Added (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.FANTASY_LEAGUE
      ],
      header_label: 'Pts+',
      player_value_path: stat_in_year_week('points_added')({
        params: { week }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_week_projected_points: {
      column_title: 'Projected Points (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.FANTASY_POINTS
      ],
      header_label: 'Pts',
      player_value_path: stat_in_year_week('proj_fan_pts')({
        params: { week: Math.max(1, week) }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_rest_of_season_projected_points: {
      column_title: 'Projected Points (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.FANTASY_POINTS
      ],
      header_label: 'Pts',
      player_value_path: stat_in_year_week('proj_fan_pts')({
        params: { week: 'ros' }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_season_projected_points: {
      column_title: 'Projected Points (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.FANTASY_POINTS
      ],
      header_label: 'Pts',
      player_value_path: stat_in_year_week('proj_fan_pts')(),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_week_projected_pass_yds: {
      column_title: 'Projected Passing Yards (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.PASSING
      ],
      header_label: 'YDS',
      player_value_path: stat_in_year_week('proj_pass_yds')({
        params: { week }
      }),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_week_projected_pass_tds: {
      column_title: 'Projected Passing Touchdowns (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.PASSING
      ],
      header_label: 'TD',
      player_value_path: stat_in_year_week('proj_pass_tds')({
        params: { week }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_week_projected_pass_ints: {
      column_title: 'Projected Interceptions (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.PASSING
      ],
      header_label: 'INT',
      player_value_path: stat_in_year_week('proj_pass_ints')({
        params: { week }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_season_projected_pass_yds: {
      column_title: 'Projected Passing Yards (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.PASSING
      ],
      header_label: 'YDS',
      player_value_path: stat_in_year_week('proj_pass_yds')(),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_season_projected_pass_tds: {
      column_title: 'Projected Passing Touchdowns (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.PASSING
      ],
      header_label: 'TD',
      player_value_path: stat_in_year_week('proj_pass_tds')(),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_season_projected_pass_ints: {
      column_title: 'Projected Interceptions (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.PASSING
      ],
      header_label: 'INT',
      player_value_path: stat_in_year_week('proj_pass_ints')(),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_rest_of_season_projected_pass_yds: {
      column_title: 'Projected Passing Yards (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.PASSING
      ],
      header_label: 'YDS',
      player_value_path: stat_in_year_week('proj_pass_yds')({
        params: { week: 'ros' }
      }),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_rest_of_season_projected_pass_tds: {
      column_title: 'Projected Passing Touchdowns (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.PASSING
      ],
      header_label: 'TD',
      player_value_path: stat_in_year_week('proj_pass_tds')({
        params: { week: 'ros' }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_rest_of_season_projected_pass_ints: {
      column_title: 'Projected Interceptions (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.PASSING
      ],
      header_label: 'INT',
      player_value_path: stat_in_year_week('proj_pass_ints')({
        params: { week: 'ros' }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_week_projected_rush_atts: {
      column_title: 'Projected Rushing Attempts (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.RUSHING
      ],
      header_label: 'ATT',
      player_value_path: stat_in_year_week('proj_rush_atts')({
        params: { week }
      }),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_week_projected_rush_yds: {
      column_title: 'Projected Rushing Yards (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.RUSHING
      ],
      header_label: 'YDS',
      player_value_path: stat_in_year_week('proj_rush_yds')({
        params: { week }
      }),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_week_projected_rush_tds: {
      column_title: 'Projected Rushing Touchdowns (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.RUSHING
      ],
      header_label: 'TD',
      player_value_path: stat_in_year_week('proj_rush_tds')({
        params: { week }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_week_projected_fumbles_lost: {
      column_title: 'Projected Fumbles (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.RUSHING
      ],
      header_label: 'FUM',
      player_value_path: stat_in_year_week('proj_fum_lost')({
        params: { week }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_season_projected_rush_atts: {
      column_title: 'Projected Rushing Attempts (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.RUSHING
      ],
      header_label: 'ATT',
      player_value_path: stat_in_year_week('proj_rush_atts')(),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_season_projected_rush_yds: {
      column_title: 'Projected Rushing Yards (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.RUSHING
      ],
      header_label: 'YDS',
      player_value_path: stat_in_year_week('proj_rush_yds')(),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_season_projected_rush_tds: {
      column_title: 'Projected Rushing Touchdowns (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.RUSHING
      ],
      header_label: 'TD',
      player_value_path: stat_in_year_week('proj_rush_tds')(),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_season_projected_fumbles_lost: {
      column_title: 'Projected Fumbles (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.RUSHING
      ],
      header_label: 'FUM',
      player_value_path: stat_in_year_week('proj_fum_lost')(),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_rest_of_season_projected_rush_atts: {
      column_title: 'Projected Rushing Attempts (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.RUSHING
      ],
      header_label: 'ATT',
      player_value_path: stat_in_year_week('proj_rush_atts')({
        params: { week: 'ros' }
      }),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_rest_of_season_projected_rush_yds: {
      column_title: 'Projected Rushing Yards (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.RUSHING
      ],
      header_label: 'YDS',
      player_value_path: stat_in_year_week('proj_rush_yds')({
        params: { week: 'ros' }
      }),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_rest_of_season_projected_rush_tds: {
      column_title: 'Projected Rushing Touchdowns (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.RUSHING
      ],
      header_label: 'TD',
      player_value_path: stat_in_year_week('proj_rush_tds')({
        params: { week: 'ros' }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_rest_of_season_projected_fumbles_lost: {
      column_title: 'Projected Fumbles (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.RUSHING
      ],
      header_label: 'FUM',
      player_value_path: stat_in_year_week('proj_fum_lost')({
        params: { week: 'ros' }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_week_projected_targets: {
      column_title: 'Projected Targets (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.RECEIVING
      ],
      header_label: 'TGT',
      player_value_path: stat_in_year_week('proj_trg')({ params: { week } }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_week_projected_recs: {
      column_title: 'Projected Receptions (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.RECEIVING
      ],
      header_label: 'REC',
      player_value_path: stat_in_year_week('proj_recs')({ params: { week } }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_week_projected_rec_yds: {
      column_title: 'Projected Receiving Yards (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.RECEIVING
      ],
      header_label: 'YDS',
      player_value_path: stat_in_year_week('proj_rec_yds')({
        params: { week }
      }),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_week_projected_rec_tds: {
      column_title: 'Projected Receiving Touchdowns (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.RECEIVING
      ],
      header_label: 'TD',
      player_value_path: stat_in_year_week('proj_rec_tds')({
        params: { week }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_season_projected_targets: {
      column_title: 'Projected Targets (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.RECEIVING
      ],
      header_label: 'TGT',
      player_value_path: stat_in_year_week('proj_trg')(),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_season_projected_recs: {
      column_title: 'Projected Receptions (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.RECEIVING
      ],
      header_label: 'REC',
      player_value_path: stat_in_year_week('proj_recs')(),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_season_projected_rec_yds: {
      column_title: 'Projected Receiving Yards (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.RECEIVING
      ],
      header_label: 'YDS',
      player_value_path: stat_in_year_week('proj_rec_yds')(),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_season_projected_rec_tds: {
      column_title: 'Projected Receiving Touchdowns (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.RECEIVING
      ],
      header_label: 'TD',
      player_value_path: stat_in_year_week('proj_rec_tds')(),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_rest_of_season_projected_targets: {
      column_title: 'Projected Targets (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.RECEIVING
      ],
      header_label: 'TGT',
      player_value_path: stat_in_year_week('proj_trg')({
        params: { week: 'ros' }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_rest_of_season_projected_recs: {
      column_title: 'Projected Receptions (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.RECEIVING
      ],
      header_label: 'REC',
      player_value_path: stat_in_year_week('proj_recs')({
        params: { week: 'ros' }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_rest_of_season_projected_rec_yds: {
      column_title: 'Projected Receiving Yards (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.RECEIVING
      ],
      header_label: 'YDS',
      player_value_path: stat_in_year_week('proj_rec_yds')({
        params: { week: 'ros' }
      }),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_rest_of_season_projected_rec_tds: {
      column_title: 'Projected Receiving Touchdowns (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.RECEIVING
      ],
      header_label: 'TD',
      player_value_path: stat_in_year_week('proj_rec_tds')({
        params: { week: 'ros' }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    // 'stats.pts': {
    //   column_title: 'Fantasy Points',
    //   column_groups: [COLUMN_GROUPS.FANTASY_POINTS],
    //   header_label: 'PTS',
    //   player_value_path: 'stats.pts',
    //   fixed: 1,
    //   percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
    //   percentile_field: 'pts',
    //   size: 70,
    //   data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    // },

    player_espn_open_score: create_espn_score_field({
      score_type: 'open',
      label: 'OPEN'
    }),
    player_espn_catch_score: create_espn_score_field({
      score_type: 'catch',
      label: 'CATCH'
    }),
    player_espn_overall_score: create_espn_score_field({
      score_type: 'overall',
      label: 'OVR'
    }),
    player_espn_yac_score: create_espn_score_field({
      score_type: 'yac',
      label: 'YAC'
    }),

    // opponent_pass_pa: {
    //   column_title: 'Opponent pass atts over average',
    //   column_groups: [COLUMN_GROUPS.MATCHUP],
    //   header_label: 'ATT',
    //   percentile_field: 'pa',
    //   ...opponent_field('pa'),
    //   size: 70,
    //   data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    // },
    // opponent_pass_pc: {
    //   column_title: 'Opponent pass comps over average',
    //   column_groups: [COLUMN_GROUPS.MATCHUP],
    //   header_label: 'COMP',
    //   percentile_field: 'pc',
    //   ...opponent_field('pc'),
    //   size: 70,
    //   data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    // },
    // opponent_pass_py: {
    //   column_title: 'Opponent pass yds over average',
    //   column_groups: [COLUMN_GROUPS.MATCHUP],
    //   header_label: 'YDS',
    //   percentile_field: 'py',
    //   ...opponent_field('py'),
    //   size: 70,
    //   data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    // },
    // opponent_pass_tdp: {
    //   column_title: 'Opponent pass tds over average',
    //   column_groups: [COLUMN_GROUPS.MATCHUP],
    //   header_label: 'TD',
    //   percentile_field: 'tdp',
    //   ...opponent_field('tdp'),
    //   size: 70,
    //   data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    // },
    // opponent_pass_ints: {
    //   column_title: 'Opponent pass ints over average',
    //   column_groups: [COLUMN_GROUPS.MATCHUP],
    //   header_label: 'INTS',
    //   percentile_field: 'ints',
    //   ...opponent_field('ints'),
    //   size: 70,
    //   data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    // },

    // opponent_rush_ra: {
    //   column_title: 'Opponent rush atts over average',
    //   column_groups: [COLUMN_GROUPS.MATCHUP],
    //   header_label: 'ATT',
    //   percentile_field: 'ra',
    //   ...opponent_field('ra'),
    //   size: 70,
    //   data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    // },
    // opponent_rush_ry: {
    //   column_title: 'Opponent rush yds over average',
    //   column_groups: [COLUMN_GROUPS.MATCHUP],
    //   header_label: 'YDS',
    //   percentile_field: 'ry',
    //   ...opponent_field('ry'),
    //   size: 70,
    //   data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    // },
    // opponent_rush_tdr: {
    //   column_title: 'Opponent rush tds over average',
    //   column_groups: [COLUMN_GROUPS.MATCHUP],
    //   header_label: 'TD',
    //   percentile_field: 'tdr',
    //   ...opponent_field('tdr'),
    //   size: 70,
    //   data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    // },

    // opponent_recv_trg: {
    //   column_title: 'Opponent targets over average',
    //   column_groups: [COLUMN_GROUPS.MATCHUP],
    //   header_label: 'TRG',
    //   percentile_field: 'trg',
    //   ...opponent_field('trg'),
    //   size: 70,
    //   data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    // },
    // opponent_recv_rec: {
    //   column_title: 'Opponent recs over average',
    //   column_groups: [COLUMN_GROUPS.MATCHUP],
    //   header_label: 'REC',
    //   percentile_field: 'rec',
    //   ...opponent_field('rec'),
    //   size: 70,
    //   data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    // },
    // opponent_recv_recy: {
    //   column_title: 'Opponent rec yds over average',
    //   column_groups: [COLUMN_GROUPS.MATCHUP],
    //   header_label: 'YDS',
    //   percentile_field: 'recy',
    //   ...opponent_field('recy'),
    //   size: 70,
    //   data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    // },
    // opponent_recv_tdrec: {
    //   column_title: 'Opponent recv tds over average',
    //   column_groups: [COLUMN_GROUPS.MATCHUP],
    //   header_label: 'TD',
    //   percentile_field: 'tdrec',
    //   ...opponent_field('tdrec'),
    //   size: 70,
    //   data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    // }

    player_pass_yards_from_plays: from_play_field({
      column_title: 'Passing Yards (By Play)',
      column_groups: [COLUMN_GROUPS.PASSING, COLUMN_GROUPS.TOTALS],
      header_label: 'YDS',
      player_value_path: 'pass_yds_from_plays'
    }),
    player_pass_attempts_from_plays: from_play_field({
      column_title: 'Passing Attempts (By Play)',
      column_groups: [COLUMN_GROUPS.PASSING, COLUMN_GROUPS.TOTALS],
      header_label: 'ATT',
      player_value_path: 'pass_atts_from_plays'
    }),
    player_pass_touchdowns_from_plays: from_play_field({
      column_title: 'Passing Touchdowns (By Play)',
      column_groups: [COLUMN_GROUPS.PASSING, COLUMN_GROUPS.TOTALS],
      header_label: 'TD',
      player_value_path: 'pass_tds_from_plays'
    }),
    player_pass_interceptions_from_plays: from_play_field({
      column_title: 'Passing Interceptions (By Play)',
      column_groups: [COLUMN_GROUPS.PASSING, COLUMN_GROUPS.TOTALS],
      header_label: 'INT',
      player_value_path: 'pass_ints_from_plays'
    }),
    player_dropped_passing_yards_from_plays: from_play_field({
      column_title: 'Dropped Passing Yards (By Play)',
      column_groups: [COLUMN_GROUPS.PASSING],
      header_label: 'DRP YDS',
      player_value_path: 'drop_pass_yds_from_plays'
    }),
    player_pass_completion_percentage_from_plays: from_play_field({
      column_title: 'Passing Completion Percentage (By Play)',
      column_groups: [COLUMN_GROUPS.PASSING, COLUMN_GROUPS.EFFICIENCY],
      header_label: 'COMP%',
      player_value_path: 'pass_comp_pct_from_plays',
      fixed: 1
    }),
    player_pass_touchdown_percentage_from_plays: from_play_field({
      column_title: 'Passing Touchdown Percentage (By Play)',
      column_groups: [COLUMN_GROUPS.PASSING, COLUMN_GROUPS.EFFICIENCY],
      header_label: 'TD%',
      player_value_path: 'pass_td_pct_from_plays',
      fixed: 1
    }),
    player_pass_interception_percentage_from_plays: from_play_field({
      column_title: 'Passing Interception Percentage (By Play)',
      column_groups: [COLUMN_GROUPS.PASSING, COLUMN_GROUPS.EFFICIENCY],
      header_label: 'INT%',
      player_value_path: 'pass_int_pct_from_plays',
      fixed: 1
    }),
    player_pass_interception_worthy_percentage_from_plays: from_play_field({
      column_title: 'Passing Interception Worthy Percentage (By Play)',
      column_groups: [COLUMN_GROUPS.PASSING, COLUMN_GROUPS.EFFICIENCY],
      header_label: 'BAD%',
      player_value_path: 'pass_int_worthy_pct_from_plays',
      fixed: 1
    }),
    player_pass_yards_after_catch_from_plays: from_play_field({
      column_title: 'Passing Yards After Catch (By Play)',
      column_groups: [
        COLUMN_GROUPS.PASSING,
        COLUMN_GROUPS.EFFICIENCY,
        COLUMN_GROUPS.AFTER_CATCH
      ],
      header_label: 'YAC',
      player_value_path: 'pass_yds_after_catch_from_plays'
    }),
    player_pass_yards_after_catch_per_completion_from_plays: from_play_field({
      column_title: 'Passing Yards After Catch Per Completion (By Play)',
      column_groups: [
        COLUMN_GROUPS.PASSING,
        COLUMN_GROUPS.EFFICIENCY,
        COLUMN_GROUPS.AFTER_CATCH
      ],
      header_label: 'YAC/C',
      player_value_path: 'pass_yds_after_catch_per_comp_from_plays',
      fixed: 1
    }),
    player_pass_yards_per_pass_attempt_from_plays: from_play_field({
      column_title: 'Passing Yards Per Pass Attempt (By Play)',
      column_groups: [COLUMN_GROUPS.PASSING, COLUMN_GROUPS.EFFICIENCY],
      header_label: 'Y/A',
      player_value_path: 'pass_yds_per_att_from_plays',
      fixed: 1
    }),
    player_pass_depth_per_pass_attempt_from_plays: from_play_field({
      column_title: 'Passing Depth of Target Per Pass Attempt (By Play)',
      column_groups: [COLUMN_GROUPS.PASSING],
      header_label: 'DOT',
      player_value_path: 'pass_depth_per_att_from_plays',
      fixed: 1
    }),
    player_pass_air_yards_from_plays: from_play_field({
      column_title: 'Passing Air Yards (By Play)',
      column_groups: [COLUMN_GROUPS.PASSING],
      header_label: 'AY',
      player_value_path: 'pass_air_yds_from_plays'
    }),
    player_completed_air_yards_per_completion_from_plays: from_play_field({
      column_title: 'Completed Air Yards Per Completion (By Play)',
      column_groups: [COLUMN_GROUPS.PASSING],
      header_label: 'CAY/C',
      player_value_path: 'comp_air_yds_per_comp_from_plays'
    }),
    player_passing_air_conversion_ratio_from_plays: from_play_field({
      column_title: 'Passing Air Conversion Ratio (By Play)',
      column_groups: [COLUMN_GROUPS.PASSING],
      header_label: 'PACR',
      player_value_path: 'pass_air_conv_ratio_from_plays',
      fixed: 1
    }),
    player_sacked_from_plays: from_play_field({
      column_title: 'Sacks (By Play)',
      column_groups: [COLUMN_GROUPS.PASSING],
      header_label: 'SK',
      player_value_path: 'sacked_from_plays'
    }),
    player_sacked_yards_from_plays: from_play_field({
      column_title: 'Sack Yards (By Play)',
      column_groups: [COLUMN_GROUPS.PASSING],
      header_label: 'SK YDS',
      player_value_path: 'sacked_yds_from_plays'
    }),
    player_sacked_percentage_from_plays: from_play_field({
      column_title: 'Sack Percentage (By Play)',
      column_groups: [COLUMN_GROUPS.PASSING],
      header_label: 'SK%',
      player_value_path: 'sacked_pct_from_plays',
      fixed: 1
    }),
    player_quarterback_hits_percentage_from_plays: from_play_field({
      column_title: 'QB Hits Percentage (By Play)',
      column_groups: [COLUMN_GROUPS.PASSING],
      header_label: 'HIT%',
      player_value_path: 'qb_hit_pct_from_plays',
      fixed: 1
    }),
    player_quarterback_pressures_percentage_from_plays: from_play_field({
      column_title: 'QB Pressures Percentage (By Play)',
      column_groups: [COLUMN_GROUPS.PASSING],
      header_label: 'PRSS%',
      player_value_path: 'qb_press_pct_from_plays',
      fixed: 1
    }),
    player_quarterback_hurries_percentage_from_plays: from_play_field({
      column_title: 'QB Hurries Percentage (By Play)',
      column_groups: [COLUMN_GROUPS.PASSING],
      header_label: 'HRRY%',
      player_value_path: 'qb_hurry_pct_from_plays',
      fixed: 1
    }),
    player_pass_net_yards_per_attempt_from_plays: from_play_field({
      column_title: 'Passing Net Yards Per Attempt (By Play)',
      column_groups: [COLUMN_GROUPS.PASSING],
      header_label: 'NY/A',
      player_value_path: 'pass_net_yds_per_att_from_plays',
      fixed: 1
    }),
    player_rush_yards_from_plays: from_play_field({
      column_title: 'Rushing Yards (By Play)',
      column_groups: [COLUMN_GROUPS.RUSHING],
      header_label: 'YDS',
      player_value_path: 'rush_yds_from_plays'
    }),
    player_rush_touchdowns_from_plays: from_play_field({
      column_title: 'Rushing Touchdowns (By Play)',
      column_groups: [COLUMN_GROUPS.RUSHING],
      header_label: 'TD',
      player_value_path: 'rush_tds_from_plays'
    }),
    player_rush_yds_per_attempt_from_plays: from_play_field({
      column_title: 'Rushing Yards Per Attempt (By Play)',
      column_groups: [COLUMN_GROUPS.RUSHING],
      header_label: 'Y/A',
      player_value_path: 'rush_yds_per_att_from_plays',
      fixed: 1
    }),
    player_rush_attempts_from_plays: from_play_field({
      column_title: 'Rushing Attempts (By Play)',
      column_groups: [COLUMN_GROUPS.RUSHING],
      header_label: 'ATT',
      player_value_path: 'rush_atts_from_plays'
    }),
    player_rush_first_downs_from_plays: from_play_field({
      column_title: 'Rushing First Downs (By Play)',
      column_groups: [COLUMN_GROUPS.RUSHING],
      header_label: 'FD',
      player_value_path: 'rush_first_downs_from_plays'
    }),
    player_positive_rush_attempts_from_plays: from_play_field({
      column_title: 'Positive Yardage Rush Attempts (By Play)',
      column_groups: [COLUMN_GROUPS.RUSHING],
      header_label: 'POS',
      player_value_path: 'positive_rush_atts_from_plays'
    }),
    player_rush_yards_after_contact_from_plays: from_play_field({
      column_title: 'Rushing Yards After Contact (By Play)',
      column_groups: [COLUMN_GROUPS.RUSHING],
      header_label: 'YAC',
      player_value_path: 'rush_yds_after_contact_from_plays'
    }),
    player_rush_yards_after_contact_per_attempt_from_plays: from_play_field({
      column_title: 'Rushing Yards After Contact Per Attempt (By Play)',
      column_groups: [COLUMN_GROUPS.RUSHING],
      header_label: 'YAC/A',
      player_value_path: 'rush_yds_after_contact_per_att_from_plays',
      fixed: 1
    }),
    player_rush_attempts_share_from_plays: from_play_field({
      column_title: 'Share of Team Rushing Attempts (By Play)',
      column_groups: [COLUMN_GROUPS.RUSHING],
      header_label: 'ATT%',
      player_value_path: 'rush_att_share_from_plays',
      fixed: 1
    }),
    player_rush_yards_share_from_plays: from_play_field({
      column_title: 'Share of Team Rushing Yardage (By Play)',
      column_groups: [COLUMN_GROUPS.RUSHING],
      header_label: 'YDS%',
      player_value_path: 'rush_yds_share_from_plays',
      fixed: 1
    }),
    player_fumble_percentage_from_plays: from_play_field({
      column_title: 'Fumble Percentage (By Play)',
      column_groups: [COLUMN_GROUPS.RUSHING],
      header_label: 'FUM%',
      player_value_path: 'fumble_pct_from_plays',
      fixed: 1
    }),
    player_positive_rush_percentage_from_plays: from_play_field({
      column_title: 'Positive Rushing Yardage Percentage (By Play)',
      column_groups: [COLUMN_GROUPS.RUSHING],
      header_label: 'POS%',
      player_value_path: 'positive_rush_pct_from_plays',
      fixed: 1
    }),
    player_successful_rush_percentage_from_plays: from_play_field({
      column_title: 'Successful Rush Percentage (By Play)',
      column_groups: [COLUMN_GROUPS.RUSHING],
      header_label: 'SUCC%',
      player_value_path: 'succ_rush_pct_from_plays',
      fixed: 1
    }),
    player_broken_tackles_from_plays: from_play_field({
      column_title: 'Broken Tackles (By Play)',
      column_groups: [COLUMN_GROUPS.RUSHING],
      header_label: 'BT',
      player_value_path: 'broken_tackles_from_plays'
    }),
    player_broken_tackles_per_rush_attempt_from_plays: from_play_field({
      column_title: 'Broken Tackles Per Rush Attempt (By Play)',
      column_groups: [COLUMN_GROUPS.RUSHING],
      header_label: 'BT/A',
      player_value_path: 'broken_tackles_per_rush_att_from_plays',
      fixed: 1
    }),
    player_receptions_from_plays: from_play_field({
      column_title: 'Receptions (By Play)',
      column_groups: [COLUMN_GROUPS.RECEIVING],
      header_label: 'REC',
      player_value_path: 'recs_from_plays'
    }),
    player_receiving_yards_from_plays: from_play_field({
      column_title: 'Receiving Yards (By Play)',
      column_groups: [COLUMN_GROUPS.RECEIVING],
      header_label: 'YDS',
      player_value_path: 'rec_yds_from_plays'
    }),
    player_receiving_touchdowns_from_plays: from_play_field({
      column_title: 'Receiving Touchdowns (By Play)',
      column_groups: [COLUMN_GROUPS.RECEIVING],
      header_label: 'TD',
      player_value_path: 'rec_tds_from_plays'
    }),
    player_drops_from_plays: from_play_field({
      column_title: 'Drops (By Play)',
      column_groups: [COLUMN_GROUPS.RECEIVING],
      header_label: 'DRP',
      player_value_path: 'drops_from_plays'
    }),
    player_dropped_receiving_yards_from_plays: from_play_field({
      column_title: 'Dropped Receiving Yards (By Play)',
      column_groups: [COLUMN_GROUPS.RECEIVING],
      header_label: 'DRP YDS',
      player_value_path: 'drop_rec_yds_from_plays'
    }),
    player_targets_from_plays: from_play_field({
      column_title: 'Targets (By Play)',
      column_groups: [COLUMN_GROUPS.RECEIVING],
      header_label: 'TGT',
      player_value_path: 'trg_from_plays'
    }),
    player_deep_targets_from_plays: from_play_field({
      column_title: 'Deep Targets (By Play)',
      column_groups: [COLUMN_GROUPS.RECEIVING],
      header_label: 'DEEP',
      player_value_path: 'deep_trg_from_plays'
    }),
    player_deep_targets_percentage_from_plays: from_play_field({
      column_title: 'Deep Target Percentage (By Play)',
      column_groups: [COLUMN_GROUPS.RECEIVING],
      header_label: 'DEEP%',
      player_value_path: 'deep_trg_pct_from_plays',
      fixed: 1
    }),
    player_air_yards_per_target_from_plays: from_play_field({
      column_title: 'Air Yards Per Target / Average Depth of Target (By Play)',
      column_groups: [COLUMN_GROUPS.RECEIVING],
      header_label: 'AY/T',
      player_value_path: 'air_yds_per_trg_from_plays',
      fixed: 1
    }),
    player_air_yards_from_plays: from_play_field({
      column_title: 'Air Yards (By Play)',
      column_groups: [COLUMN_GROUPS.RECEIVING],
      header_label: 'AY',
      player_value_path: 'air_yds_from_plays'
    }),
    player_air_yards_share_from_plays: from_play_field({
      column_title: 'Share of Team Air Yards (By Play)',
      column_groups: [COLUMN_GROUPS.RECEIVING],
      header_label: 'AY%',
      player_value_path: 'air_yds_share_from_plays',
      fixed: 1
    }),
    player_target_share_from_plays: from_play_field({
      column_title: 'Share of Team Targets (By Play)',
      column_groups: [COLUMN_GROUPS.RECEIVING],
      header_label: 'TGT%',
      player_value_path: 'trg_share_from_plays',
      fixed: 1
    }),
    player_weighted_opportunity_rating_from_plays: from_play_field({
      column_title: 'Weighted Opportunity Rating (By Play)',
      column_groups: [COLUMN_GROUPS.RECEIVING],
      header_label: 'WOPR',
      player_value_path: 'weighted_opp_rating_from_plays',
      fixed: 1
    }),
    player_receiver_air_conversion_ratio_from_plays: from_play_field({
      column_title: 'Receiver Air Conversion Ratio (By Play)',
      column_groups: [COLUMN_GROUPS.RECEIVING],
      header_label: 'RACR',
      player_value_path: 'rec_air_conv_ratio_from_plays',
      fixed: 1
    }),
    player_receiving_yards_per_reception_from_plays: from_play_field({
      column_title: 'Receiving Yards Per Reception (By Play)',
      column_groups: [COLUMN_GROUPS.RECEIVING],
      header_label: 'Y/R',
      player_value_path: 'rec_yds_per_rec_from_plays',
      fixed: 1
    }),
    player_receiving_yards_per_target_from_plays: from_play_field({
      column_title: 'Receiving Yards Per Target (By Play)',
      column_groups: [COLUMN_GROUPS.RECEIVING],
      header_label: 'Y/T',
      player_value_path: 'rec_yds_per_trg_from_plays',
      fixed: 1
    }),
    player_receiving_yards_after_catch_per_reception_from_plays:
      from_play_field({
        column_title: 'Receiving Yards After Catch Per Reception (By Play)',
        column_groups: [COLUMN_GROUPS.RECEIVING],
        header_label: 'YAC/R',
        player_value_path: 'rec_yds_after_catch_per_rec_from_plays',
        fixed: 1
      }),

    player_fantasy_points_from_seasonlogs: from_scoring_format_seasonlogs({
      column_title: 'Fantasy Points (By Season)',
      header_label: 'PTS',
      player_value_path: 'points_from_seasonlogs'
    }),
    player_fantasy_points_per_game_from_seasonlogs:
      from_scoring_format_seasonlogs({
        column_title: 'Fantasy Points Per Game (By Season)',
        header_label: 'PTS/G',
        player_value_path: 'points_per_game_from_seasonlogs'
      }),
    player_fantasy_games_played_from_seasonlogs: from_scoring_format_seasonlogs(
      {
        column_title: 'Games Played (By Season)',
        header_label: 'GP',
        player_value_path: 'games_from_seasonlogs'
      }
    ),
    player_fantasy_points_rank_from_seasonlogs: from_scoring_format_seasonlogs({
      column_title: 'Fantasy Points Rank (By Season)',
      header_label: 'RNK',
      player_value_path: 'points_rnk_from_seasonlogs'
    }),
    player_fantasy_points_position_rank_from_seasonlogs:
      from_scoring_format_seasonlogs({
        column_title: 'Fantasy Points Position Rank (By Season)',
        header_label: 'POS RNK',
        player_value_path: 'points_pos_rnk_from_seasonlogs'
      }),

    player_fantasy_points_from_careerlogs: from_scoring_format_careerlogs({
      column_title: 'Fantasy Points (Career)',
      header_label: 'PTS',
      player_value_path: 'points_from_careerlogs'
    }),
    player_fantasy_points_per_game_from_careerlogs:
      from_scoring_format_careerlogs({
        column_title: 'Fantasy Points Per Game (Career)',
        header_label: 'PTS/G',
        player_value_path: 'points_per_game_from_careerlogs'
      }),
    player_fantasy_games_played_from_careerlogs: from_scoring_format_careerlogs(
      {
        column_title: 'Games Played (Career)',
        header_label: 'GP',
        player_value_path: 'games_from_careerlogs'
      }
    ),
    player_fantasy_top_1_seasons_from_careerlogs:
      from_scoring_format_careerlogs({
        column_title: 'Top 1 Season (Career)',
        header_label: 'TOP 1',
        player_value_path: 'top_1_from_careerlogs'
      }),
    player_fantasy_top_3_seasons_from_careerlogs:
      from_scoring_format_careerlogs({
        column_title: 'Top 3 Seasons (Career)',
        header_label: 'TOP 3',
        player_value_path: 'top_3_from_careerlogs'
      }),
    player_fantasy_top_6_seasons_from_careerlogs:
      from_scoring_format_careerlogs({
        column_title: 'Top 6 Seasons (Career)',
        header_label: 'TOP 6',
        player_value_path: 'top_6_from_careerlogs'
      }),
    player_fantasy_top_12_seasons_from_careerlogs:
      from_scoring_format_careerlogs({
        column_title: 'Top 12 Seasons (Career)',
        header_label: 'TOP 12',
        player_value_path: 'top_12_from_careerlogs'
      }),
    player_fantasy_top_24_seasons_from_careerlogs:
      from_scoring_format_careerlogs({
        column_title: 'Top 24 Seasons (Career)',
        header_label: 'TOP 24',
        player_value_path: 'top_24_from_careerlogs'
      }),
    player_fantasy_top_36_seasons_from_careerlogs:
      from_scoring_format_careerlogs({
        column_title: 'Top 36 Seasons (Career)',
        header_label: 'TOP 36',
        player_value_path: 'top_36_from_careerlogs'
      }),

    player_startable_games_from_seasonlogs: from_league_format_seasonlogs({
      column_title: 'Startable Games (Season)',
      header_label: 'SG',
      player_value_path: 'startable_games_from_seasonlogs'
    }),
    player_earned_salary_from_seasonlogs: from_league_format_seasonlogs({
      column_title: 'Earned Salary (Season)',
      header_label: 'Earned Salary',
      player_value_path: 'earned_salary_from_seasonlogs'
    }),
    player_points_added_from_seasonlogs: from_league_format_seasonlogs({
      column_title: 'Points Added (Season)',
      header_label: 'Pts+',
      player_value_path: 'points_added_from_seasonlogs'
    }),
    player_points_added_per_game_from_seasonlogs: from_league_format_seasonlogs(
      {
        column_title: 'Points Added Per Game (Season)',
        header_label: 'Pts+/G',
        player_value_path: 'points_added_per_game_from_seasonlogs'
      }
    ),
    player_points_added_rank_from_seasonlogs: from_league_format_seasonlogs({
      column_title: 'Points Added Rank (Season)',
      header_label: 'Pts+ Rnk',
      player_value_path: 'points_added_rnk_from_seasonlogs'
    }),
    player_points_added_position_rank_from_seasonlogs:
      from_league_format_seasonlogs({
        column_title: 'Points Added Position Rank (Season)',
        header_label: 'Pts+ Pos Rnk',
        player_value_path: 'points_added_pos_rnk_from_seasonlogs'
      }),

    player_startable_games_from_careerlogs: from_league_format_careerlogs({
      column_title: 'Startable Games (Career)',
      header_label: 'SG',
      player_value_path: 'startable_games_from_careerlogs'
    }),
    player_points_added_from_careerlogs: from_league_format_careerlogs({
      column_title: 'Points Added (Career)',
      header_label: 'Pts+',
      player_value_path: 'points_added_from_careerlogs'
    }),
    player_points_added_per_game_from_careerlogs: from_league_format_careerlogs(
      {
        column_title: 'Points Added Per Game (Career)',
        header_label: 'Pts+/G',
        player_value_path: 'points_added_per_game_from_careerlogs'
      }
    ),
    player_best_season_points_added_per_game_from_careerlogs:
      from_league_format_careerlogs({
        column_title: 'Best Season Points Added Per Game (Career)',
        header_label: 'Best Pts+/G',
        player_value_path: 'best_season_points_added_per_game_from_careerlogs'
      }),
    player_best_season_earned_salary_from_careerlogs:
      from_league_format_careerlogs({
        column_title: 'Best Season Earned Salary (Career)',
        header_label: 'Earned Salary',
        player_value_path: 'best_season_earned_salary_from_careerlogs'
      }),
    player_points_added_first_three_seasons_from_careerlogs:
      from_league_format_careerlogs({
        column_title: 'Points Added First 3 Seasons (Career)',
        header_label: 'Pts+ 1st 3',
        player_value_path: 'points_added_first_three_seas_from_careerlogs'
      }),
    player_points_added_first_four_seasons_from_careerlogs:
      from_league_format_careerlogs({
        column_title: 'Points Added First 4 Seasons (Career)',
        header_label: 'Pts+ 1st 4',
        player_value_path: 'points_added_first_four_seas_from_careerlogs'
      }),
    player_points_added_first_five_seasons_from_careerlogs:
      from_league_format_careerlogs({
        column_title: 'Points Added First 5 Seasons (Career)',
        header_label: 'Pts+ 1st 5',
        player_value_path: 'points_added_first_five_seas_from_careerlogs'
      }),
    player_points_added_first_season_from_careerlogs:
      from_league_format_careerlogs({
        column_title: 'Points Added First Season (Career)',
        header_label: 'Pts+ Rookie',
        player_value_path: 'points_added_first_seas_from_careerlogs'
      }),
    player_points_added_second_season_from_careerlogs:
      from_league_format_careerlogs({
        column_title: 'Points Added Second Season (Career)',
        header_label: 'Pts+ 2nd Year',
        player_value_path: 'points_added_second_seas_from_careerlogs'
      }),
    player_points_added_third_season_from_careerlogs:
      from_league_format_careerlogs({
        column_title: 'Points Added Third Season (Career)',
        header_label: 'Pts+ 3rd Year',
        player_value_path: 'points_added_third_seas_from_careerlogs'
      }),
    player_draft_rank_from_careerlogs: from_league_format_careerlogs({
      column_title: 'Draft Class Rank',
      header_label: 'Draft Rnk',
      player_value_path: 'draft_rank_from_careerlogs'
    }),

    player_season_prop_line_from_betting_markets: from_betting_market({
      column_title: 'Season Prop Line',
      header_label: 'LINE',
      player_value_path: 'season_prop_line_betting_market',
      column_groups: [
        COLUMN_GROUPS.BETTING_MARKETS,
        COLUMN_GROUPS.SEASON_PROPS
      ],
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
          // TODO should enable spliting and multi select on split enabled
          data_type: table_constants.TABLE_DATA_TYPES.SELECT,
          values: [2023, 2024],
          default_value: 2024,
          single: true
        }
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
          single: true
        },
        week: {
          data_type: table_constants.TABLE_DATA_TYPES.SELECT,
          values: constants.nflWeeks,
          default_value: 1,
          single: true
        }
      }
    })
  }

  if (is_logged_in) {
    fields.player_league_roster_status = {
      column_title: 'Roster Status',
      header_label: '',
      size: 50,
      component: React.memo(PlayerRowStatusColumn),
      data_type: table_constants.TABLE_DATA_TYPES.SELECT,
      sticky: true,
      column_values: [
        'free_agent',
        'active_roster',
        'practice_squad',
        'injured_reserve'
      ]
    }

    fields.player_league_salary = {
      column_title: 'Player Salary',
      column_groups: [COLUMN_GROUPS.FANTASY_LEAGUE],
      header_label: 'Salary',
      player_value_path: 'player_salary',
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    }

    fields.player_week_projected_market_salary = {
      column_title: 'Projected Market Salary',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.FANTASY_LEAGUE
      ],
      header_label: 'Market',
      player_value_path: stat_in_year_week('market_salary')({
        params: { week }
      }),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    }

    fields.player_season_projected_inflation_adjusted_market_salary = {
      column_title: 'Inflation Adj. Projected Market Salary',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.FANTASY_LEAGUE
      ],
      header_label: 'Adjusted',
      player_value_path: stat_in_year_week('inflation_adjusted_market_salary')({
        params: { week: 0 }
      }),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    }

    fields.player_week_projected_salary_adjusted_points_added = {
      column_title: 'Salary Adj. Points Added (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.FANTASY_LEAGUE
      ],
      header_label: 'Value',
      player_value_path: stat_in_year_week('salary_adjusted_points_added')({
        params: { week }
      }),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    }

    fields.player_season_projected_salary_adjusted_points_added = {
      column_title: 'Salary Adj. Points Added (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.FANTASY_LEAGUE
      ],
      header_label: 'Value',
      player_value_path: stat_in_year_week('salary_adjusted_points_added')({
        params: { week: 0 }
      }),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    }

    fields.player_rest_of_season_projected_salary_adjusted_points_added = {
      column_title: 'Salary Adj. Points Added (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.FANTASY_LEAGUE
      ],
      header_label: 'Value',
      player_value_path: stat_in_year_week('salary_adjusted_points_added')({
        params: { week: 'ros' }
      }),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    }
  }

  for (const [key, value] of Object.entries(fields)) {
    fields[key].column_id = key
    // TODO remove - I think this is not used
    fields[key].key_path = value.player_value_path
      ? value.player_value_path.split('.')
      : []
    fields[key].column_name = value.player_value_path
    fields[key].accessorKey = value.player_value_path || key
  }

  return fields
}
