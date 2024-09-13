import { constants } from '#libs-shared'

import db from '#db'
import player_projected_column_definitions from './player-projected-column-definitions.mjs'
import player_espn_score_column_definitions from './player-espn-score-column-definitions.mjs'
import player_betting_market_column_definitions from './player-betting-market-column-definitions.mjs'
import player_table_column_definitions from './player-table-column-definitions.mjs'
import player_league_format_logs_column_definitions from './player-league-format-logs-column-definitions.mjs'
import player_scoring_format_logs_column_definitions from './player-scoring-format-logs-column-definitions.mjs'
import player_stats_from_plays_column_definitions from './player-stats-from-plays-column-definitions.mjs'
import player_fantasy_points_from_plays_column_definitions from './player-fantasy-points-from-plays-column-definitions.mjs'
import defensive_player_stats_from_plays_column_definitions from './defensive-player-stats-from-plays-column-definitions.mjs'
import team_stats_from_plays_column_definitions from './team-stats-from-plays-column-definitions.mjs'
import player_keeptradecut_column_definitions from './player-keeptradecut-column-definitions.mjs'
import player_games_played_column_definitions from './player-games-played-column-definitions.mjs'
import player_contract_column_definitions from './player-contract-column-definitions.mjs'
import player_pff_seasonlogs_column_definitions from './player-pff-seasonlogs-column-definitions.mjs'
import player_dfs_salaries_column_definitions from './player-dfs-salaries-column-definitions.mjs'
import player_rankings_column_definitions from './player-rankings-column-definitions.mjs'
import player_practice_column_definitions from './player-practice-column-definitions.mjs'
import espn_line_win_rates_column_definitions from './espn-line-win-rates-column-definitions.mjs'

const player_league_roster_status_select = `CASE WHEN rosters_players.slot = ${constants.slots.IR} THEN 'injured_reserve' WHEN rosters_players.slot = ${constants.slots.PS} THEN 'practice_squad' WHEN rosters_players.slot IS NULL THEN 'free_agent' ELSE 'active_roster' END`

export default {
  ...player_projected_column_definitions,
  ...player_espn_score_column_definitions,
  ...player_betting_market_column_definitions,
  ...player_table_column_definitions,
  ...player_league_format_logs_column_definitions,
  ...player_scoring_format_logs_column_definitions,
  ...player_stats_from_plays_column_definitions,
  ...player_fantasy_points_from_plays_column_definitions,
  ...defensive_player_stats_from_plays_column_definitions,
  ...team_stats_from_plays_column_definitions,
  ...player_keeptradecut_column_definitions,
  ...player_games_played_column_definitions,
  ...player_contract_column_definitions,
  ...player_pff_seasonlogs_column_definitions,
  ...player_dfs_salaries_column_definitions,
  ...player_rankings_column_definitions,
  ...player_practice_column_definitions,
  ...espn_line_win_rates_column_definitions,

  player_league_roster_status: {
    table_name: 'rosters_players',
    main_where: () => player_league_roster_status_select,
    main_select: () => [
      `${player_league_roster_status_select} AS player_league_roster_status`,
      'rosters_players.slot',
      'rosters_players.tid',
      'rosters_players.tag'
    ],
    main_group_by: () => [
      'rosters_players.slot',
      'rosters_players.tid',
      'rosters_players.tag'
    ],
    join: ({ query, params = {} }) => {
      const {
        year = constants.season.year,
        week = constants.season.week,
        lid = 1
      } = params
      query.leftJoin('rosters_players', function () {
        this.on('rosters_players.pid', '=', 'player.pid')
        this.andOn('rosters_players.year', '=', year)
        this.andOn('rosters_players.week', '=', week)
        this.andOn('rosters_players.lid', '=', lid)
      })
    },
    get_cache_info: () => ({
      cache_ttl: 1000 * 60 * 60 * 12, // 12 hours
      cache_expire_at: null
    })
  },
  player_league_salary: {
    column_name: 'value',
    table_name: 'transactions',
    table_alias: () => 'latest_transactions',
    select_as: () => 'player_salary',
    main_where: ({ table_name }) => `${table_name}.value`,
    join: ({ query, params = {} }) => {
      const { lid = 1 } = params
      query.leftJoin(
        db('transactions')
          .select('pid')
          .select(db.raw('MAX(timestamp) as latest_timestamp'))
          .where('lid', lid)
          .groupBy('pid')
          .as('transactions'),
        'transactions.pid',
        'player.pid'
      )
      query.leftJoin('transactions as latest_transactions', function () {
        this.on('latest_transactions.pid', '=', 'player.pid')
        this.andOn(
          'latest_transactions.timestamp',
          '=',
          'transactions.latest_timestamp'
        )
      })
    },
    get_cache_info: () => ({
      cache_ttl: 1000 * 60 * 60 * 12, // 12 hours
      // TODO set it to start of next offseason during the regular season and 12 hours during the offseason
      cache_expire_at: null
    })
  },

  week_opponent_abbreviation: {},
  week_opponent_points_allowed_over_average: {}
}
