import { fork, takeLatest, call, select } from 'redux-saga/effects'

import { player_actions } from '@core/players'
import { api_get_plays, api_get_play_stats } from '@core/api'
import { current_season } from '@constants'
import { get_request_history, get_scoreboard, get_app } from '@core/selectors'
import { scoreboard_actions } from '@core/scoreboard'
import { matchups_actions } from '@core/matchups'

export function* loadPlays({ week, year } = {}) {
  const state = yield select()
  const request_history = get_request_history(state)
  const scoreboard = get_scoreboard(state)
  const app = get_app(state)

  const target_week = week || scoreboard.get('week') || current_season.week
  const target_year = year || app.year || current_season.year
  const is_current_week =
    target_week === current_season.week && target_year === current_season.year
  const request_key = is_current_week
    ? 'GET_PLAYS'
    : `GET_PLAYS_${target_year}_${target_week}`

  if (request_history.has(request_key)) {
    return
  }

  const params = {}
  if (!is_current_week) {
    params.week = target_week
    params.year = target_year
  }

  yield call(api_get_plays, params)
  yield call(api_get_play_stats, params)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watch_fetch_players_fulfilled() {
  if (current_season.isRegularSeason) {
    yield takeLatest(
      [
        player_actions.FETCH_ALL_PLAYERS_FULFILLED,
        player_actions.FETCH_LEAGUE_PLAYERS_FULFILLED,
        player_actions.FETCH_TEAM_PLAYERS_FULFILLED
      ],
      loadPlays
    )
  }
}

export function* watch_scoreboard_select_week() {
  yield takeLatest(
    scoreboard_actions.SCOREBOARD_SELECT_WEEK,
    function* (action) {
      yield call(loadPlays, { week: action.payload.week })
    }
  )
}

export function* watch_select_matchup() {
  yield takeLatest(matchups_actions.SELECT_MATCHUP, function* (action) {
    if (action.payload.week) {
      yield call(loadPlays, {
        week: action.payload.week,
        year: action.payload.year
      })
    }
  })
}

//= ====================================
//  ROOT
// -------------------------------------

export const play_sagas = [
  fork(watch_fetch_players_fulfilled),
  fork(watch_scoreboard_select_week),
  fork(watch_select_matchup)
]
