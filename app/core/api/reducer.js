import { Map } from 'immutable'

import { percentileActions } from '@core/percentiles/actions'
import { seasonlogsActions } from '@core/seasonlogs/actions'
import { matchupsActions } from '@core/matchups/actions'
import { gamelogsActions } from '@core/gamelogs/actions'
import { waiverActions } from '@core/waivers/actions'
import { player_actions } from '@core/players/actions'
import { teamActions } from '@core/teams/actions'
import { data_views_actions } from '@core/data-views'
import { league_team_daily_values_actions } from '@core/league-team-daily-values/actions'
import { seasons_actions } from '@core/seasons/actions'
import { playActions } from '@core/plays/actions'
import { statActions } from '@core/stats/actions'
const initialState = new Map({
  request_history: new Map()
})

export function apiReducer(state = initialState, { payload, type }) {
  switch (type) {
    case percentileActions.GET_PERCENTILES_PENDING:
      return state.setIn(
        ['request_history', `GET_PERCENTILES_${payload.opts.percentile_key}`],
        true
      )

    case percentileActions.GET_PERCENTILES_FAILED:
      return state.deleteIn([
        'request_history',
        `GET_PERCENTILES_${payload.opts.percentile_key}`
      ])

    case seasonlogsActions.GET_NFL_TEAM_SEASONLOGS_PENDING:
      return state.setIn(
        [
          'request_history',
          `GET_NFL_TEAM_SEASONLOGS_LEAGUE_${payload.opts.leagueId}`
        ],
        true
      )

    case seasonlogsActions.GET_NFL_TEAM_SEASONLOGS_FULFILLED:
      return state.deleteIn([
        'request_history',
        `GET_NFL_TEAM_SEASONLOGS_LEAGUE_${payload.opts.leagueId}`
      ])

    case matchupsActions.GET_MATCHUPS_PENDING:
      return state.setIn(
        [
          'request_history',
          `GET_MATCHUPS_LEAGUE_${payload.opts.leagueId}_${payload.opts.year}`
        ],
        true
      )

    case matchupsActions.GET_MATCHUPS_FAILED:
      return state.deleteIn([
        'request_history',
        `GET_MATCHUPS_LEAGUE_${payload.opts.leagueId}_${payload.opts.year}`
      ])

    case gamelogsActions.GET_PLAYERS_GAMELOGS_PENDING:
      return state.setIn(
        [
          'request_history',
          `GET_GAMELOGS_${payload.opts.leagueId}_${payload.opts.year || 'X'}_${
            payload.opts.week || 'X'
          }_${payload.opts.nfl_team || 'X'}_${payload.opts.opponent || 'X'}_${
            payload.opts.position || 'X'
          }`
        ],
        true
      )

    case gamelogsActions.GET_PLAYERS_GAMELOGS_FAILED:
      return state.deleteIn([
        'request_history',
        `GET_GAMELOGS_${payload.opts.leagueId}_${payload.opts.year || 'X'}_${
          payload.opts.week || 'X'
        }_${payload.opts.nfl_team || 'X'}_${payload.opts.opponent || 'X'}_${
          payload.opts.position || 'X'
        }`
      ])

    case waiverActions.GET_WAIVERS_FULFILLED:
      return state.setIn(
        [
          'request_history',
          `GET_WAIVERS_${payload.opts.leagueId}_${payload.opts.teamId}_${payload.opts.type}`
        ],
        true
      )

    case league_team_daily_values_actions.GET_LEAGUE_TEAM_DAILY_VALUES_FULFILLED:
      return state.setIn(
        [
          'request_history',
          `GET_LEAGUE_TEAM_DAILY_VALUES_${payload.opts.leagueId}`
        ],
        true
      )

    case player_actions.GET_PLAYER_BETTING_MARKETS_PENDING:
      return state.setIn(
        ['request_history', `GET_PLAYER_BETTING_MARKETS_${payload.opts.pid}`],
        true
      )

    case player_actions.GET_PLAYER_BETTING_MARKETS_FAILED:
      return state.deleteIn([
        'request_history',
        `GET_PLAYER_BETTING_MARKETS_${payload.opts.pid}`
      ])

    case teamActions.GET_TEAMS_PENDING:
      return state.setIn(
        [
          'request_history',
          `GET_TEAMS_${payload.opts.leagueId}_${payload.opts.year}`
        ],
        true
      )

    case teamActions.GET_TEAMS_FAILED:
      return state.deleteIn([
        'request_history',
        `GET_TEAMS_${payload.opts.leagueId}_${payload.opts.year}`
      ])

    case data_views_actions.GET_DATA_VIEWS_FULFILLED:
      return state.setIn(
        [
          'request_history',
          `GET_DATA_VIEWS${payload.opts.user_id ? `_USER_ID_${payload.opts.user_id}` : payload.opts.username ? `_USERNAME_${payload.opts.username}` : ''}`
        ],
        true
      )

    case seasons_actions.GET_SEASON_PENDING:
      return state.setIn(
        [
          'request_history',
          `GET_SEASON_LEAGUE_${payload.opts.leagueId}_${payload.opts.year}`
        ],
        true
      )

    case seasons_actions.GET_SEASON_FAILED:
      return state.deleteIn([
        'request_history',
        `GET_SEASON_LEAGUE_${payload.opts.leagueId}_${payload.opts.year}`
      ])

    case playActions.GET_PLAYS_PENDING:
      return state.setIn(['request_history', 'GET_PLAYS'], true)

    case playActions.GET_PLAYS_FAILED:
      return state.deleteIn(['request_history', 'GET_PLAYS'])

    case statActions.GET_CHARTED_PLAYS_PENDING:
      return state.setIn(
        [
          'request_history',
          `GET_CHARTED_PLAYS_${payload.opts.years.join('_')}`
        ],
        true
      )

    case statActions.GET_CHARTED_PLAYS_FAILED:
      return state.deleteIn([
        'request_history',
        `GET_CHARTED_PLAYS_${payload.opts.years.join('_')}`
      ])

    default:
      return state
  }
}
