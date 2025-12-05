import { createSelector } from 'reselect'
import { List } from 'immutable'

import { percentile_actions } from '@core/percentiles'
import { current_season } from '@constants'
import { store } from '@core/store.js'
import { get_game_by_team, get_seasonlogs } from '@core/selectors'
import PlayerRowOpponent from '@components/player-row-opponent'
import { seasonlogs_actions } from '@core/seasonlogs/actions'

export const get_player_fields = createSelector(
  (state) =>
    state.getIn(['players', 'week'], new List([current_season.week])).get(0),
  (state) => state.getIn(['players', 'opponent_time_period'], ''),
  (state) => state,
  (week, opponent_time_period, state) =>
    PlayerFields({ week, opponent_time_period, state })
)

// category - required
// column_header - required
// csv_header - required

// load - optional

// component - optional
// header_className - optional

// get_player_field_value - optional
// player_value_path - optional

// get_percentile_key - optional
// percentile_key - optional
// percentile_field - optional

// fixed - optional
function PlayerFields({ week, opponent_time_period, state }) {
  const time_period_suffix = opponent_time_period
    ? `_${opponent_time_period}`
    : ''

  const opponent_field = (stat_field) => {
    return {
      get_percentile_key: (player_map) => {
        const pos = player_map.get('pos')
        return `${pos}_AGAINST_ADJ${time_period_suffix}`
      },
      fixed: 1,
      show_positivity: true,
      load: () => {
        const positions = state.getIn(['players', 'positions'])
        positions.forEach((pos) => {
          const percentile_key = `${pos}_AGAINST_ADJ${time_period_suffix}`
          store.dispatch(percentile_actions.load_percentiles(percentile_key))
        })
        store.dispatch(seasonlogs_actions.load_nfl_team_seasonlogs())
      },
      get_player_field_value: (player_map) => {
        const nfl_team = player_map.get('team')
        const pos = player_map.get('pos')
        const game = get_game_by_team(state, { nfl_team, week })
        const seasonlogs = get_seasonlogs(state)
        if (!game) {
          return null
        }

        const isHome = game.h === nfl_team
        const opp = isHome ? game.v : game.h
        const stat_key = `${pos}_AGAINST_ADJ${time_period_suffix}`
        const value = seasonlogs.getIn(
          ['nfl_teams', opp, stat_key, stat_field],
          0
        )

        return value
      }
    }
  }

  const fields = {
    opponent: {
      category: 'matchup',
      column_header: 'Opponent',
      csv_header: 'Opponent',
      component: PlayerRowOpponent,
      header_className: 'game-opponent',
      get_player_field_value: (player_map) => {
        const nfl_team = player_map.get('team')
        const game = get_game_by_team(state, { nfl_team, week })
        if (!game) {
          return null
        }

        const isHome = game.h === nfl_team
        const opp = isHome ? game.v : game.h
        return opp
      }
    },
    opponent_strength: {
      category: 'matchup',
      column_header: 'Strength',
      csv_header: 'Opponent Strength',
      get_percentile_key: (player_map) => {
        const pos = player_map.get('pos')
        return `${pos}_AGAINST_ADJ${time_period_suffix}`
      },
      percentile_field: 'pts',
      fixed: 1,
      show_positivity: true,
      load: () => {
        const positions = state.getIn(['players', 'positions'])
        positions.forEach((pos) => {
          const percentile_key = `${pos}_AGAINST_ADJ${time_period_suffix}`
          store.dispatch(percentile_actions.load_percentiles(percentile_key))
        })
        store.dispatch(seasonlogs_actions.load_nfl_team_seasonlogs())
      },
      get_player_field_value: (player_map) => {
        const nfl_team = player_map.get('team')
        const pos = player_map.get('pos')
        const game = get_game_by_team(state, { nfl_team, week })
        const seasonlogs = get_seasonlogs(state)
        if (!game) {
          return null
        }

        const isHome = game.h === nfl_team
        const opp = isHome ? game.v : game.h
        const stat_key = `${pos}_AGAINST_ADJ${time_period_suffix}`
        const pts = seasonlogs.getIn(['nfl_teams', opp, stat_key, 'pts'], 0)

        return pts
      }
    },
    value: {
      category: 'management',
      column_header: 'Salary',
      csv_header: 'Projected Salary',
      player_value_path: 'value'
    },
    'salary_adj_pts_added.week': {
      category: 'management',
      column_header: 'Value',
      csv_header: 'Projected Value',
      player_value_path: `salary_adj_pts_added.${week}`
    },
    'market_salary.week': {
      category: 'management',
      column_header: 'Market',
      csv_header: 'Projected Market Salary',
      player_value_path: `market_salary.${week}`
    },
    market_salary_adj: {
      category: 'management',
      column_header: 'Adjusted',
      csv_header: 'Projected Adjusted Market Salary',
      player_value_path: 'market_salary_adj'
    },

    'pts_added.ros': {
      category: 'fantasy',
      column_header: 'Pts+',
      csv_header: 'Projected Points Added (Rest-Of-Season)',
      player_value_path: 'pts_added.ros',
      fixed: 1
    },
    'pts_added.0': {
      category: 'fantasy',
      column_header: 'Pts+',
      csv_header: 'Projected Points Added (Season)',
      player_value_path: 'pts_added.0'
    },
    'pts_added.week': {
      category: `Week ${week}`,
      column_header: 'Pts+',
      csv_header: 'Projected Points Added (Week)',
      player_value_path: `pts_added.${week}`,
      fixed: 1
    },

    'points.week.total': {
      category: `Week ${week}`,
      column_header: 'Proj',
      csv_header: 'Projected Points (Week)',
      player_value_path: `points.${week}.total`,
      fixed: 1
    },
    'points.ros.total': {
      category: 'fantasy',
      column_header: 'Proj',
      csv_header: 'Projected Points (Rest-Of-Season)',
      player_value_path: 'points.ros.total',
      fixed: 1
    },
    'points.0.total': {
      category: 'fantasy',
      column_header: 'Proj',
      csv_header: 'Projected Points (Season)',
      player_value_path: 'points.0.total',
      fixed: 1
    },

    'projection.week.pa': {
      category: 'passing',
      column_header: 'ATT',
      csv_header: 'Projected Passing Attempts (Week)',
      player_value_path: `projection.${week}.pa`
    },
    'projection.week.py': {
      category: 'passing',
      column_header: 'YDS',
      csv_header: 'Projected Passing Yards (Week)',
      player_value_path: `projection.${week}.py`
    },
    'projection.week.tdp': {
      category: 'passing',
      column_header: 'TD',
      csv_header: 'Projected Passing Touchdowns (Week)',
      player_value_path: `projection.${week}.tdp`,
      fixed: 1
    },
    'projection.week.ints': {
      category: 'passing',
      column_header: 'INT',
      csv_header: 'Projected Interceptions (Week)',
      player_value_path: `projection.${week}.ints`,
      fixed: 1
    },

    'projection.0.pa': {
      category: 'passing',
      column_header: 'ATT',
      csv_header: 'Projected Passing Attempts (Season)',
      player_value_path: 'projection.0.pa'
    },
    'projection.0.py': {
      category: 'passing',
      column_header: 'YDS',
      csv_header: 'Projected Passing Yards (Season)',
      player_value_path: 'projection.0.py'
    },
    'projection.0.tdp': {
      category: 'passing',
      column_header: 'TD',
      csv_header: 'Projected Passing Touchdowns (Season)',
      player_value_path: 'projection.0.tdp',
      fixed: 1
    },
    'projection.0.ints': {
      category: 'passing',
      column_header: 'INT',
      csv_header: 'Projected Interceptions (Season)',
      player_value_path: 'projection.0.ints',
      fixed: 1
    },

    'projection.ros.pa': {
      category: 'passing',
      column_header: 'ATT',
      csv_header: 'Projected Passing Attempts (Rest-Of-Season)',
      player_value_path: 'projection.ros.pa'
    },
    'projection.ros.py': {
      column_header: 'YDS',
      csv_header: 'Projected Passing Yards (Rest-Of-Season)',
      player_value_path: 'projection.ros.py',
      category: 'passing'
    },
    'projection.ros.tdp': {
      category: 'passing',
      column_header: 'TD',
      csv_header: 'Projected Passing Touchdowns (Rest-Of-Season)',
      player_value_path: 'projection.ros.tdp',
      fixed: 1
    },
    'projection.ros.ints': {
      category: 'passing',
      column_header: 'INT',
      csv_header: 'Projected Interceptions (Rest-Of-Season)',
      player_value_path: 'projection.ros.ints',
      fixed: 1
    },

    'projection.week.ra': {
      category: 'rushing',
      column_header: 'ATT',
      csv_header: 'Projected Rushing Attempts (Week)',
      player_value_path: `projection.${week}.ra`
    },
    'projection.week.ry': {
      category: 'rushing',
      column_header: 'YDS',
      csv_header: 'Projected Rushing Yards (Week)',
      player_value_path: `projection.${week}.ry`
    },
    'projection.week.tdr': {
      category: 'rushing',
      column_header: 'TD',
      csv_header: 'Projected Rushing Touchdowns (Week)',
      player_value_path: `projection.${week}.tdr`,
      fixed: 1
    },
    'projection.week.fuml': {
      category: 'rushing',
      column_header: 'FUM',
      csv_header: 'Projected Fumbles (Week)',
      player_value_path: `projection.${week}.fuml`,
      fixed: 1
    },

    'projection.0.ra': {
      category: 'rushing',
      column_header: 'ATT',
      csv_header: 'Projected Rushing Attempts (Season)',
      player_value_path: 'projection.0.ra'
    },
    'projection.0.ry': {
      category: 'rushing',
      column_header: 'YDS',
      csv_header: 'Projected Rushing Yards (Season)',
      player_value_path: 'projection.0.ry'
    },
    'projection.0.tdr': {
      category: 'rushing',
      column_header: 'TD',
      csv_header: 'Projected Rushing Touchdowns (Season)',
      player_value_path: 'projection.0.tdr',
      fixed: 1
    },
    'projection.0.fuml': {
      category: 'rushing',
      column_header: 'FUM',
      csv_header: 'Projected Fumbles (Season)',
      player_value_path: 'projection.0.fuml',
      fixed: 1
    },

    'projection.ros.ra': {
      category: 'rushing',
      column_header: 'ATT',
      csv_header: 'Projected Rushing Attempts (Rest-Of-Season)',
      player_value_path: 'projection.ros.ra'
    },
    'projection.ros.ry': {
      category: 'rushing',
      column_header: 'YDS',
      csv_header: 'Projected Rushing Yards (Rest-Of-Season)',
      player_value_path: 'projection.ros.ry'
    },
    'projection.ros.tdr': {
      category: 'rushing',
      column_header: 'TD',
      csv_header: 'Projected Rushing Touchdowns (Rest-Of-Season)',
      player_value_path: 'projection.ros.tdr',
      fixed: 1
    },
    'projection.ros.fuml': {
      category: 'rushing',
      column_header: 'FUM',
      csv_header: 'Projected Fumbles (Rest-Of-Season)',
      player_value_path: 'projection.ros.fuml',
      fixed: 1
    },

    'projection.week.trg': {
      category: 'receiving',
      column_header: 'TAR',
      csv_header: 'Projected Targets (Week)',
      player_value_path: `projection.${week}.trg`,
      fixed: 1
    },
    'projection.week.rec': {
      category: 'receiving',
      column_header: 'REC',
      csv_header: 'Projected Receptions (Week)',
      player_value_path: `projection.${week}.rec`,
      fixed: 1
    },
    'projection.week.recy': {
      category: 'receiving',
      column_header: 'YDS',
      csv_header: 'Projected Receiving Yards (Week)',
      player_value_path: `projection.${week}.recy`
    },
    'projection.week.tdrec': {
      category: 'receiving',
      column_header: 'TD',
      csv_header: 'Projected Receiving Touchdowns (Week)',
      player_value_path: `projection.${week}.tdrec`,
      fixed: 1
    },

    'projection.0.trg': {
      category: 'receiving',
      column_header: 'TAR',
      csv_header: 'Projected Targets (Season)',
      player_value_path: 'projection.0.trg',
      fixed: 1
    },
    'projection.0.rec': {
      category: 'receiving',
      column_header: 'REC',
      csv_header: 'Projected Receptions (Season)',
      player_value_path: 'projection.0.rec',
      fixed: 1
    },
    'projection.0.recy': {
      category: 'receiving',
      column_header: 'YDS',
      csv_header: 'Projected Receiving Yards (Season)',
      player_value_path: 'projection.0.recy'
    },
    'projection.0.tdrec': {
      category: 'receiving',
      column_header: 'TD',
      csv_header: 'Projected Receiving Touchdowns (Season)',
      player_value_path: 'projection.0.tdrec',
      fixed: 1
    },

    'projection.ros.trg': {
      category: 'receiving',
      column_header: 'TAR',
      csv_header: 'Projected Targets (Rest-Of-Season)',
      player_value_path: 'projection.ros.trg',
      fixed: 1
    },
    'projection.ros.rec': {
      category: 'receiving',
      column_header: 'REC',
      csv_header: 'Projected Receptions (Rest-Of-Season)',
      player_value_path: 'projection.ros.rec',
      fixed: 1
    },
    'projection.ros.recy': {
      category: 'receiving',
      column_header: 'YDS',
      csv_header: 'Projected Receiving Yards (Rest-Of-Season)',
      player_value_path: 'projection.ros.recy'
    },
    'projection.ros.tdrec': {
      category: 'receiving',
      column_header: 'TD',
      csv_header: 'Projected Receiving Touchdowns (Rest-Of-Season)',
      player_value_path: 'projection.ros.tdrec',
      fixed: 1
    },

    'stats.pts': {
      category: 'fantasy',
      column_header: 'PTS',
      csv_header: 'Fantasy Points',
      player_value_path: 'stats.pts',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'pts'
    },

    'stats.pa': {
      category: 'passing',
      column_header: 'ATT',
      csv_header: 'Passing Attempts',
      player_value_path: 'stats.pa',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'pa'
    },
    'stats.py': {
      category: 'passing',
      column_header: 'YDS',
      csv_header: 'Passing Yards',
      player_value_path: 'stats.py',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'py'
    },
    'stats.tdp': {
      category: 'passing',
      column_header: 'TD',
      csv_header: 'Passing Touchdowns',
      player_value_path: 'stats.tdp',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'tdp'
    },
    'stats.ints': {
      category: 'passing',
      column_header: 'INT',
      csv_header: 'Interceptions',
      player_value_path: 'stats.ints',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'ints'
    },
    'stats.drppy': {
      category: 'passing',
      column_header: 'DRP YDS',
      csv_header: 'Dropped Passing Yards',
      player_value_path: 'stats.drppy',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'drppy'
    },
    'stats.pc_pct': {
      category: 'efficiency',
      column_header: 'COMP%',
      csv_header: 'Passing Completion Percentage',
      player_value_path: 'stats.pc_pct',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'pc_pct'
    },
    'stats.tdp_pct': {
      category: 'efficiency',
      column_header: 'TD%',
      csv_header: 'Passing Touchdown Percentage',
      player_value_path: 'stats.tdp_pct',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'tdp_pct'
    },
    'stats.ints_pct': {
      category: 'efficiency',
      column_header: 'INT%',
      csv_header: 'Passing Interception Percentage',
      player_value_path: 'stats.ints_pct',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'ints_pct'
    },
    'stats.int_worthy_pct': {
      category: 'efficiency',
      column_header: 'BAD%',
      csv_header: 'Passing Interception Worthy Percentage',
      player_value_path: 'stats.int_worthy_pct',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'int_worthy_pct'
    },
    'stats.pyac': {
      category: 'passing',
      column_header: 'YAC',
      csv_header: 'Passing Yards After Catch',
      player_value_path: 'stats.pyac',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'pyac'
    },
    'stats.pyac_pc': {
      category: 'efficiency',
      column_header: 'YAC/C',
      csv_header: 'Passing Yards After Catch Per Completion',
      player_value_path: 'stats.pyac_pc',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'pyac_pc'
    },
    'stats._ypa': {
      category: 'efficiency',
      column_header: 'Y/A',
      csv_header: 'Passing Yards Per Pass Attempt',
      player_value_path: 'stats._ypa',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_ypa'
    },
    'stats.pdot_pa': {
      category: 'efficiency',
      column_header: 'DOT',
      csv_header: 'Passing Depth of Target per Pass Attempt',
      player_value_path: 'stats.pdot_pa',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'pdot_pa'
    },
    'stats.pdot': {
      category: 'air yards',
      column_header: 'AY',
      csv_header: 'Passing Air Yards',
      player_value_path: 'stats.pdot',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'pdot'
    },
    'stats.pcay_pc': {
      category: 'air yards',
      column_header: 'CAY/C',
      csv_header: 'Completed Air Yards Per Completion',
      player_value_path: 'stats.pcay_pc',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'pcay_pc'
    },
    'stats._pacr': {
      category: 'air yards',
      column_header: 'PACR',
      csv_header: 'Passing Air Conversion Ratio (PACR)',
      player_value_path: 'stats._pacr',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_pacr'
    },
    'stats.sk': {
      category: 'pressure',
      column_header: 'SK',
      csv_header: 'Sacks',
      player_value_path: 'stats.sk',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'sk'
    },
    'stats.sky': {
      category: 'pressure',
      column_header: 'SKY',
      csv_header: 'Sack Yards',
      player_value_path: 'stats.sky',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'sky'
    },
    'stats.sk_pct': {
      category: 'pressure',
      column_header: 'SK%',
      csv_header: 'Sack Percentage',
      player_value_path: 'stats.sk_pct',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'sk_pct'
    },
    'stats.qb_hit_pct': {
      category: 'pressure',
      column_header: 'HIT%',
      csv_header: 'QB Hit Percentage',
      player_value_path: 'stats.qb_hit_pct',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'qb_hit_pct'
    },
    'stats.qb_pressure_pct': {
      category: 'pressure',
      column_header: 'PRSS%',
      csv_header: 'QB Pressure Percentage',
      player_value_path: 'stats.qb_pressure_pct',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'qb_pressure_pct'
    },
    'stats.qb_hurry_pct': {
      category: 'pressure',
      column_header: 'HRRY%',
      csv_header: 'QB Hurry Percentage',
      player_value_path: 'stats.qb_hurry_pct',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'qb_hurry_pct'
    },
    'stats._nygpa': {
      category: 'pressure',
      column_header: 'NY/A',
      csv_header: 'Net Yards Per Pass Attempt',
      player_value_path: 'stats._nygpa',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_nygpa'
    },

    'stats.ry': {
      category: 'rushing',
      column_header: 'YDS',
      csv_header: 'Rushing Yards',
      player_value_path: 'stats.ry',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'ry'
    },
    'stats.tdr': {
      category: 'rushing',
      column_header: 'TD',
      csv_header: 'Rushing Touchdowns',
      player_value_path: 'stats.tdr',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'tdr'
    },
    'stats.ry_pra': {
      category: 'efficiency',
      column_header: 'YPC',
      csv_header: 'Rushing Yards Per Rush Attempt',
      player_value_path: 'stats.ry_pra',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'ry_pra'
    },
    'stats.ra': {
      category: 'rushing',
      column_header: 'ATT',
      csv_header: 'Rushing Attempts',
      player_value_path: 'stats.ra',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'ra'
    },
    'stats.rfd': {
      category: 'rushing',
      column_header: 'FD',
      csv_header: 'Rushing First Downs',
      player_value_path: 'stats.rfd',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'rfd'
    },
    'stats.posra': {
      category: 'efficiency',
      column_header: 'POS',
      csv_header: 'Positive Yardage Rush Attempts',
      player_value_path: 'stats.posra',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'posra'
    },
    'stats.ryaco': {
      category: 'after contact',
      column_header: 'YDS',
      csv_header: 'Rushing Yards After Contact',
      player_value_path: 'stats.ryaco',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'ryaco'
    },
    'stats.ryaco_pra': {
      category: 'after contact',
      column_header: 'AVG',
      csv_header: 'Rushing Yards After Contact Per Rush Attempt',
      player_value_path: 'stats.ryaco_pra',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'ryaco_pra'
    },
    'stats._stra': {
      category: 'team share',
      column_header: 'ATT%',
      csv_header: 'Share of Team Rushing Attempts',
      player_value_path: 'stats._stra',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_stra'
    },
    'stats._stry': {
      category: 'team share',
      column_header: 'YDS%',
      csv_header: 'Share of Team Rushing Yardage',
      player_value_path: 'stats._stry',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_stry'
    },
    'stats._fumlpra': {
      category: 'efficiency',
      column_header: 'FUM%',
      csv_header: 'Fumble Percentage',
      player_value_path: 'stats._fumlpra',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_fumlpra'
    },
    'stats.posra_pra': {
      category: 'efficiency',
      column_header: 'POS%',
      csv_header: 'Positive Rushing Yardage Percentage',
      player_value_path: 'stats.posra_pra',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'posra_pra'
    },
    'stats.rasucc_pra': {
      category: 'efficiency',
      column_header: 'SUCC%',
      csv_header: 'Successful Rush Percentage',
      player_value_path: 'stats.rasucc_pra',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'rasucc_pra'
    },
    'stats.mbt': {
      category: 'broken tackles',
      column_header: 'BT',
      csv_header: 'Broken Tackles',
      player_value_path: 'stats.mbt',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'mbt'
    },
    'stats.mbt_pt': {
      category: 'broken tackles',
      column_header: 'BT/T',
      csv_header: 'Broken Tackles Per Rush Attempt',
      player_value_path: 'stats.mbt_pt',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'mbt_pt'
    },

    'stats.rec': {
      category: 'receiving',
      column_header: 'REC',
      csv_header: 'Receptions',
      player_value_path: 'stats.rec',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'rec'
    },
    'stats.recy': {
      category: 'receiving',
      column_header: 'YDS',
      csv_header: 'Receiving Yards',
      player_value_path: 'stats.recy',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'recy'
    },
    'stats.tdrec': {
      category: 'receiving',
      column_header: 'TD',
      csv_header: 'Receiving Touchdowns',
      player_value_path: 'stats.tdrec',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'tdrec'
    },
    'stats.drops': {
      category: 'receiving',
      column_header: 'DRP',
      csv_header: 'Drops',
      player_value_path: 'stats.drops',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'drops'
    },
    'stats.dryprecy': {
      category: 'receiving',
      column_header: 'DRP YDS',
      csv_header: 'Dropped Receiving Yards',
      player_value_path: 'stats.dryprecy',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'dryprecy'
    },
    'stats.trg': {
      category: 'opportunity',
      column_header: 'TAR',
      csv_header: 'Targets',
      player_value_path: 'stats.trg',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'trg'
    },
    'stats.dptrg_pct': {
      category: 'opportunity',
      column_header: 'DEEP%',
      csv_header: 'Percentage of Targets Traveling >= 20 Air Yards',
      player_value_path: 'stats.dptrg_pct',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'dptrg_pct'
    },
    'stats._ayptrg': {
      category: 'opportunity',
      column_header: 'DOT',
      csv_header: 'Depth Of Target',
      player_value_path: 'stats._ayptrg',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_ayptrg'
    },
    'stats.rdot': {
      category: 'opportunity',
      column_header: 'AY',
      csv_header: 'Air Yards',
      player_value_path: 'stats.rdot',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'rdot'
    },
    'stats._stray': {
      category: 'opportunity',
      column_header: 'AY%',
      csv_header: "Share of Team's Air Yards",
      player_value_path: 'stats._stray',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_stray'
    },
    'stats._sttrg': {
      category: 'opportunity',
      column_header: 'TAR%',
      csv_header: "Share of Team's Targets",
      player_value_path: 'stats._sttrg',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_sttrg'
    },
    'stats._wopr': {
      category: 'opportunity',
      column_header: 'WOPR',
      csv_header: 'Weighted Opportunity Rating',
      player_value_path: 'stats._wopr',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_wopr'
    },
    'stats._recypay': {
      category: 'efficiency',
      column_header: 'RACR',
      csv_header: 'Receiver Air Conversion Ratio (RACR)',
      player_value_path: 'stats._recypay',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_recypay'
    },
    'stats._recyprec': {
      category: 'efficiency',
      column_header: 'Y/R',
      csv_header: 'Receiving Yards Per Reception',
      player_value_path: 'stats._recyprec',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_recyprec'
    },
    'stats._recyptrg': {
      category: 'efficiency',
      column_header: 'Y/T',
      csv_header: 'Receiving Yards Per Target',
      player_value_path: 'stats._recyptrg',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_recyptrg'
    },
    'stats._ryacprec': {
      category: 'efficiency',
      column_header: 'YAC/R',
      csv_header: 'Yards After Catch Per Reception',
      player_value_path: 'stats._ryacprec',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_ryacprec'
    },

    opponent_pass_pa: {
      category: 'passing matchup',
      column_header: 'ATT',
      csv_header: 'Opponent pass atts over average',
      percentile_field: 'pa',
      ...opponent_field('pa')
    },
    opponent_pass_pc: {
      category: 'passing matchup',
      column_header: 'COMP',
      csv_header: 'Opponent pass comps over average',
      percentile_field: 'pc',
      ...opponent_field('pc')
    },
    opponent_pass_py: {
      category: 'passing matchup',
      column_header: 'YDS',
      csv_header: 'Opponent pass yds over average',
      percentile_field: 'py',
      ...opponent_field('py')
    },
    opponent_pass_tdp: {
      category: 'passing matchup',
      column_header: 'TD',
      csv_header: 'Opponent pass tds over average',
      percentile_field: 'tdp',
      ...opponent_field('tdp')
    },
    opponent_pass_ints: {
      category: 'passing matchup',
      column_header: 'INTS',
      csv_header: 'Opponent pass ints over average',
      percentile_field: 'ints',
      ...opponent_field('ints')
    },

    opponent_rush_ra: {
      category: 'rushing matchup',
      column_header: 'ATT',
      csv_header: 'Opponent rush atts over average',
      percentile_field: 'ra',
      ...opponent_field('ra')
    },
    opponent_rush_ry: {
      category: 'rushing matchup',
      column_header: 'YDS',
      csv_header: 'Opponent rush yds over average',
      percentile_field: 'ry',
      ...opponent_field('ry')
    },
    opponent_rush_tdr: {
      category: 'rushing matchup',
      column_header: 'TD',
      csv_header: 'Opponent rush tds over average',
      percentile_field: 'tdr',
      ...opponent_field('tdr')
    },

    opponent_recv_trg: {
      category: 'receiving matchup',
      column_header: 'TRG',
      csv_header: 'Opponent targets over average',
      percentile_field: 'trg',
      ...opponent_field('trg')
    },
    opponent_recv_rec: {
      category: 'receiving matchup',
      column_header: 'REC',
      csv_header: 'Opponent recs over average',
      percentile_field: 'rec',
      ...opponent_field('rec')
    },
    opponent_recv_recy: {
      category: 'receiving matchup',
      column_header: 'YDS',
      csv_header: 'Opponent recv yds over average',
      percentile_field: 'recy',
      ...opponent_field('recy')
    },
    opponent_recv_tdrec: {
      category: 'receiving matchup',
      column_header: 'TD',
      csv_header: 'Opponent recv tds over average',
      percentile_field: 'tdrec',
      ...opponent_field('tdrec')
    },

    opponent_pass_rating: {
      category: 'passing efficiency matchup',
      column_header: 'PSR',
      csv_header: 'Opponent passer rating over average',
      percentile_field: 'pass_rating',
      ...opponent_field('pass_rating')
    },
    opponent_pass_yards_per_attempt: {
      category: 'passing efficiency matchup',
      column_header: 'Y/A',
      csv_header: 'Opponent pass yards per attempt over average',
      percentile_field: 'pass_yards_per_attempt',
      ...opponent_field('pass_yards_per_attempt')
    },
    opponent_pass_comp_pct: {
      category: 'passing efficiency matchup',
      column_header: 'COMP%',
      csv_header: 'Opponent pass completion percentage over average',
      percentile_field: 'pass_comp_pct',
      ...opponent_field('pass_comp_pct')
    },
    opponent_completion_percentage_over_expectation: {
      category: 'passing efficiency matchup',
      column_header: 'CPOE',
      csv_header: 'Opponent completion percentage over expectation',
      percentile_field: 'cpoe',
      ...opponent_field('cpoe')
    },
    opponent_pass_epa_per_dropback: {
      category: 'passing efficiency matchup',
      column_header: 'EPA/ATT',
      csv_header: 'Opponent pass EPA per dropback over average',
      percentile_field: 'pass_epa_per_db',
      ...opponent_field('pass_epa_per_db')
    },
    opponent_avg_time_to_throw: {
      category: 'passing usage matchup',
      column_header: 'TTT',
      csv_header: 'Opponent average time to throw over average',
      percentile_field: 'avg_time_to_throw',
      ...opponent_field('avg_time_to_throw')
    },
    opponent_avg_time_to_pressure: {
      category: 'passing usage matchup',
      column_header: 'TTP',
      csv_header: 'Opponent average time to pressure over average',
      percentile_field: 'avg_time_to_pressure',
      ...opponent_field('avg_time_to_pressure')
    },
    opponent_avg_time_to_sack: {
      category: 'passing usage matchup',
      column_header: 'TTS',
      csv_header: 'Opponent average time to sack over average',
      percentile_field: 'avg_time_to_sack',
      ...opponent_field('avg_time_to_sack')
    },
    opponent_pressure_rate_against: {
      category: 'passing usage matchup',
      column_header: 'PRSS%',
      csv_header: 'Opponent pressure rate against over average',
      percentile_field: 'pressure_rate_against',
      ...opponent_field('pressure_rate_against')
    },
    opponent_blitz_rate: {
      category: 'passing usage matchup',
      column_header: 'BLZ%',
      csv_header: 'Opponent blitz rate over average',
      percentile_field: 'blitz_rate',
      ...opponent_field('blitz_rate')
    },
    opponent_air_yards_per_pass_att: {
      category: 'passing usage matchup',
      column_header: 'AY/PA',
      csv_header: 'Opponent air yards per pass attempt over average',
      percentile_field: 'air_yards_per_pass_att',
      ...opponent_field('air_yards_per_pass_att')
    },
    opponent_avg_target_separation: {
      category: 'passing usage matchup',
      column_header: 'TSEP',
      csv_header: 'Opponent average target separation over average',
      percentile_field: 'avg_target_separation',
      ...opponent_field('avg_target_separation')
    },
    opponent_deep_pass_att_pct: {
      category: 'passing usage matchup',
      column_header: 'DP%',
      csv_header: 'Opponent deep pass attempts percentage over average',
      percentile_field: 'deep_pass_att_pct',
      ...opponent_field('deep_pass_att_pct')
    },
    opponent_tight_window_pct: {
      category: 'passing usage matchup',
      column_header: 'TW%',
      csv_header: 'Opponent tight window passes percentage over average',
      percentile_field: 'tight_window_pct',
      ...opponent_field('tight_window_pct')
    },
    opponent_play_action_pct: {
      category: 'passing usage matchup',
      column_header: 'PA%',
      csv_header: 'Opponent play action passes percentage over average',
      percentile_field: 'play_action_pct',
      ...opponent_field('play_action_pct')
    },
    opponent_receiving_passer_rating: {
      category: 'receiving efficiency matchup',
      column_header: 'PSR',
      csv_header: 'Opponent receiver passer rating over average',
      percentile_field: 'receiving_passer_rating',
      ...opponent_field('receiving_passer_rating')
    },
    opponent_catch_rate_over_expectation: {
      category: 'receiving efficiency matchup',
      column_header: 'CROE',
      csv_header: 'Opponent catch rate over expectation',
      percentile_field: 'cpoe',
      ...opponent_field('cpoe')
    },
    opponent_recv_yards_per_reception: {
      category: 'receiving efficiency matchup',
      column_header: 'Y/R',
      csv_header: 'Opponent receiving yards per reception over average',
      percentile_field: 'recv_yards_per_reception',
      ...opponent_field('recv_yards_per_reception')
    },
    opponent_recv_yards_per_route: {
      category: 'receiving efficiency matchup',
      column_header: 'Y/RTE',
      csv_header: 'Opponent receiving yards per route over average',
      percentile_field: 'recv_yards_per_route',
      ...opponent_field('recv_yards_per_route')
    },
    opponent_receiving_epa_per_target: {
      category: 'receiving efficiency matchup',
      column_header: 'EPA/TGT',
      csv_header: 'Opponent receiving EPA per target over average',
      percentile_field: 'receiving_epa_per_target',
      ...opponent_field('receiving_epa_per_target')
    },
    opponent_receiving_epa_per_route: {
      category: 'receiving efficiency matchup',
      column_header: 'EPA/RTE',
      csv_header: 'Opponent receiving EPA per route over average',
      percentile_field: 'receiving_epa_per_route',
      ...opponent_field('receiving_epa_per_route')
    },
    opponent_receiving_yards_after_catch_over_expected: {
      category: 'receiving efficiency matchup',
      column_header: 'YAC/E',
      csv_header: 'Opponent receiving yards after catch over expected',
      percentile_field: 'receiving_yards_after_catch_over_expected',
      ...opponent_field('receiving_yards_after_catch_over_expected')
    },
    opponent_rushing_yards_over_expectation: {
      category: 'rushing efficiency matchup',
      column_header: 'RYOE',
      csv_header: 'Opponent rushing yards over expectation',
      percentile_field: 'rush_yards_over_expected',
      ...opponent_field('rush_yards_over_expected')
    },
    opponent_rushing_yards_over_expectation_per_attempt: {
      category: 'rushing efficiency matchup',
      column_header: 'RYOE/A',
      csv_header: 'Opponent rushing yards over expectation per attempt',
      percentile_field: 'rush_yards_over_expected_per_attempt',
      ...opponent_field('rush_yards_over_expected_per_attempt')
    },
    opponent_rushing_yards_after_contact_per_attempt: {
      category: 'rushing efficiency matchup',
      column_header: 'YAC/A',
      csv_header: 'Opponent rushing yards after contact per attempt',
      percentile_field: 'rush_yards_after_contact_per_attempt',
      ...opponent_field('rush_yards_after_contact_per_attempt')
    },
    opponent_rushing_success_rate: {
      category: 'rushing efficiency matchup',
      column_header: 'SUCC%',
      csv_header: 'Opponent rush success rate over average',
      percentile_field: 'rush_success_rate',
      ...opponent_field('rush_success_rate')
    },
    opponent_rushing_yards_per_attempt: {
      category: 'rushing efficiency matchup',
      column_header: 'Y/A',
      csv_header: 'Opponent rushing yards per attempt over average',
      percentile_field: 'rush_yards_per_attempt',
      ...opponent_field('rush_yards_per_attempt')
    }
  }

  for (const [key, value] of Object.entries(fields)) {
    fields[key].key = key
    fields[key].key_path = value.player_value_path
      ? value.player_value_path.split('.')
      : []
  }

  return fields
}
