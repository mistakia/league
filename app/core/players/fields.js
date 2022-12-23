import PlayerRowOpponent from '@components/player-row-opponent'
import { getSeasonlogs, seasonlogsActions } from '@core/seasonlogs'
import { getGameByTeam } from '@core/schedule'
import { percentileActions } from '@core/percentiles'
import { store } from '@core/store.js'

// category - required
// column_header - required
// csv_header - required

// load - optional

// component - optional
// header_className - optional

// getValue - optional
// player_value_path - optional

// getPercentileKey - optional
// percentile_key - optional
// percentile_field - optional

// fixed - optional

export default function ({ week, state }) {
  const opponent_field = (stat_field) => {
    return {
      getPercentileKey: (playerMap) => {
        const pos = playerMap.get('pos')
        return `${pos}_AGAINST_ADJ`
      },
      fixed: 1,
      show_positivity: true,
      load: () => {
        const positions = state.getIn(['players', 'positions'])
        positions.forEach((pos) => {
          const percentile_key = `${pos}_AGAINST_ADJ`
          store.dispatch(percentileActions.loadPercentiles(percentile_key))
        })
        store.dispatch(seasonlogsActions.load_nfl_team_seasonlogs())
      },
      getValue: (playerMap) => {
        const nfl_team = playerMap.get('team')
        const pos = playerMap.get('pos')
        const game = getGameByTeam(state, { nfl_team, week })
        const seasonlogs = getSeasonlogs(state)
        if (!game) {
          return null
        }

        const isHome = game.h === nfl_team
        const opp = isHome ? game.v : game.h
        const value = seasonlogs.getIn(
          ['nfl_teams', opp, `${pos}_AGAINST_ADJ`, stat_field],
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
      header_className: 'player__row-opponent',
      getValue: (playerMap) => {
        const nfl_team = playerMap.get('team')
        const game = getGameByTeam(state, { nfl_team, week })
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
      getPercentileKey: (playerMap) => {
        const pos = playerMap.get('pos')
        return `${pos}_AGAINST_ADJ`
      },
      percentile_field: 'pts',
      fixed: 1,
      show_positivity: true,
      load: () => {
        const positions = state.getIn(['players', 'positions'])
        positions.forEach((pos) => {
          const percentile_key = `${pos}_AGAINST_ADJ`
          store.dispatch(percentileActions.loadPercentiles(percentile_key))
        })
        store.dispatch(seasonlogsActions.load_nfl_team_seasonlogs())
      },
      getValue: (playerMap) => {
        const nfl_team = playerMap.get('team')
        const pos = playerMap.get('pos')
        const game = getGameByTeam(state, { nfl_team, week })
        const seasonlogs = getSeasonlogs(state)
        if (!game) {
          return null
        }

        const isHome = game.h === nfl_team
        const opp = isHome ? game.v : game.h
        const pts = seasonlogs.getIn(
          ['nfl_teams', opp, `${pos}_AGAINST_ADJ`, 'pts'],
          0
        )

        return pts
      }
    },
    value: {
      category: 'management',
      column_header: 'Salary',
      csv_header: 'Projected Salary',
      player_value_path: 'value'
    },
    'vorp_adj.week': {
      category: 'management',
      column_header: 'Value',
      csv_header: 'Projected Value',
      player_value_path: `vorp_adj.${week}`
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

    'vorp.ros': {
      category: 'fantasy',
      column_header: 'Pts+',
      csv_header: 'Projected Points Added (Rest-Of-Season)',
      player_value_path: 'vorp.ros',
      fixed: 1
    },
    'vorp.0': {
      category: 'fantasy',
      column_header: 'Pts+',
      csv_header: 'Projected Points Added (Season)',
      player_value_path: 'vorp.0'
    },
    'vorp.week': {
      category: `Week ${week}`,
      column_header: 'Pts+',
      csv_header: 'Projected Points Added (Week)',
      player_value_path: `vorp.${week}`,
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
    'stats.drp_py': {
      category: 'passing',
      column_header: 'DRP YDS',
      csv_header: 'Dropped Passing Yards',
      player_value_path: 'stats.drp_py',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'drp_py'
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
    'stats.intw_pct': {
      category: 'efficiency',
      column_header: 'BAD%',
      csv_header: 'Passing Interception Worthy Percentage',
      player_value_path: 'stats.intw_pct',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'intw_pct'
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
    'stats.py_pa': {
      category: 'efficiency',
      column_header: 'Y/A',
      csv_header: 'Passing Yards Per Pass Attempt',
      player_value_path: 'stats.py_pa',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'py_pa'
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
    'stats.pacr': {
      category: 'air yards',
      column_header: 'PACR',
      csv_header: 'Passing Air Conversion Ratio (PACR)',
      player_value_path: 'stats.pacr',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'pacr'
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
    'stats.qbhi_pct': {
      category: 'pressure',
      column_header: 'HIT%',
      csv_header: 'QB Hit Percentage',
      player_value_path: 'stats.qbhi_pct',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'qbhi_pct'
    },
    'stats.qbp_pct': {
      category: 'pressure',
      column_header: 'PRSS%',
      csv_header: 'QB Pressure Percentage',
      player_value_path: 'stats.qbp_pct',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'qbp_pct'
    },
    'stats.qbhu_pct': {
      category: 'pressure',
      column_header: 'HRRY%',
      csv_header: 'QB Hurry Percentage',
      player_value_path: 'stats.qbhu_pct',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'qbhu_pct'
    },
    'stats.nyg_pa': {
      value: 'stats.nyg_pa',
      category: 'pressure',
      column_header: 'NY/A',
      csv_header: 'Net Yards Per Pass Attempt',
      player_value_path: 'stats.nyg_pa',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'nyg_pa'
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
    'stats.ry_ra': {
      category: 'efficiency',
      column_header: 'YPC',
      csv_header: 'Rushing Yards Per Rush Attempt',
      player_value_path: 'stats.ry_ra',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'ry_ra'
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
    'stats.ryaco_ra': {
      category: 'after contact',
      column_header: 'AVG',
      csv_header: 'Rushing Yards After Contact Per Rush Attempt',
      player_value_path: 'stats.ryaco_ra',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'ryaco_ra'
    },
    'stats.tm_ra_share': {
      category: 'team share',
      column_header: 'ATT%',
      csv_header: 'Share of Team Rushing Attempts',
      player_value_path: 'stats.tm_ra_share',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'tm_ra_share'
    },
    'stats.tm_ry_share': {
      category: 'team share',
      column_header: 'YDS%',
      csv_header: 'Share of Team Rushing Yardage',
      player_value_path: 'stats.tm_ry_share',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'tm_ry_share'
    },
    'stats.fuml_ra': {
      category: 'efficiency',
      column_header: 'FUM%',
      csv_header: 'Fumble Percentage',
      player_value_path: 'stats.fuml_ra',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'fuml_ra'
    },
    'stats.posra_ra': {
      category: 'efficiency',
      column_header: 'POS%',
      csv_header: 'Positive Rushing Yardage Percentage',
      player_value_path: 'stats.posra_ra',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'posra_ra'
    },
    'stats.rasucc_ra': {
      value: 'stats.rasucc_ra',
      category: 'efficiency',
      column_header: 'SUCC%',
      csv_header: 'Successful Rush Percentage',
      player_value_path: 'stats.rasucc_ra',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'rasucc_ra'
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
    'stats.drp': {
      category: 'receiving',
      column_header: 'DRP',
      csv_header: 'Drops',
      player_value_path: 'stats.drp',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'drp'
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
      category: 'oppurtunity',
      column_header: 'TAR',
      csv_header: 'Targets',
      player_value_path: 'stats.trg',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'trg'
    },
    'stats.deep_trg_pct': {
      category: 'oppurtunity',
      column_header: 'DEEP%',
      csv_header: 'Percentage of Targets Traveling >= 20 Air Yards',
      player_value_path: 'stats.deep_trg_pct',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'deep_trg_pct'
    },
    'stats.ay_trg': {
      category: 'oppurtunity',
      column_header: 'DOT',
      csv_header: 'Depth Of Target',
      player_value_path: 'stats.ay_trg',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_ayptrg'
    },
    'stats.rdot': {
      category: 'oppurtunity',
      column_header: 'AY',
      csv_header: 'Air Yards',
      player_value_path: 'stats.rdot',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'rdot'
    },
    'stats.tm_ay_share': {
      category: 'oppurtunity',
      column_header: 'AY%',
      csv_header: "Share of Team's Air Yards",
      player_value_path: 'stats.tm_ay_share',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'tm_ay_share'
    },
    'stats.tm_trg_share': {
      category: 'oppurtunity',
      column_header: 'TAR%',
      csv_header: "Share of Team's Targets",
      player_value_path: 'stats.tm_trg_share',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'tm_trg_share'
    },
    'stats.wopr': {
      category: 'oppurtunity',
      column_header: 'WOPR',
      csv_header: 'Weighted Opportunity Rating',
      player_value_path: 'stats.wopr',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'wopr'
    },
    'stats.recy_ay': {
      category: 'efficiency',
      column_header: 'RACR',
      csv_header: 'Receiver Air Conversion Ratio (RACR)',
      player_value_path: 'stats.recy_ay',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'recy_ay'
    },
    'stats.recy_rec': {
      category: 'efficiency',
      column_header: 'Y/R',
      csv_header: 'Receiving Yards Per Reception',
      player_value_path: 'stats.recy_rec',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'recy_rec'
    },
    'stats.recy_trg': {
      category: 'efficiency',
      column_header: 'Y/T',
      csv_header: 'Receiving Yards Per Target',
      player_value_path: 'stats.recy_trg',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'recy_trg'
    },
    'stats.yac_rec': {
      label: 'YAC/R',
      name: 'Yards After Catch Per Reception',
      value: 'stats.yac_rec',
      category: 'efficiency',
      column_header: 'YAC/R',
      csv_header: 'Yards After Catch Per Reception',
      player_value_path: 'stats.yac_rec',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'yac_rec'
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
