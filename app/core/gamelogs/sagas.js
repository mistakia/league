import { fork, select, call, takeEvery } from 'redux-saga/effects'

import { api_get_players_gamelogs } from '@core/api'
import { get_app, get_request_history } from '@core/selectors'
import { matchups_actions } from '@core/matchups'
import { gamelogs_actions } from './actions'
import { current_season } from '@constants'

export function* load({ payload }) {
  const { leagueId } = yield select(get_app)
  const { year, week, nfl_team, opponent, position } = payload

  const params = {
    leagueId,
    year,
    week,
    nfl_team,
    position
  }

  switch (position) {
    case 'QB':
      params.passing = true
      params.rushing = true
      break
    case 'RB':
      params.rushing = true
      params.receiving = true
      break
    case 'WR':
    case 'TE':
      params.receiving = true
      break
  }

  // TODO this should check against a final_week param for the given season (different seasons have different final weeks)
  if (week === current_season.finalWeek) {
    yield call(load, {
      payload: {
        leagueId,
        year,
        week: week - 1,
        nfl_team,
        opponent,
        position
      }
    })
  }

  const request_history = yield select(get_request_history)

  if (request_history.has(`GET_GAMELOGS_${leagueId}_${year}_X_X_X_X`)) {
    return
  }

  if (
    week &&
    request_history.has(`GET_GAMELOGS_${leagueId}_${year}_${week}_X_X_X`)
  ) {
    return
  }

  const key = `GET_GAMELOGS_${leagueId}_${year}_${week || 'X'}_${
    nfl_team || 'X'
  }_${opponent || 'X'}_${position || 'X'}`

  if (!request_history.has(key)) {
    yield call(api_get_players_gamelogs, params)
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watch_load_matchups() {
  yield takeEvery(matchups_actions.LOAD_MATCHUPS, load)
}

export function* watch_load_player_gamelogs() {
  yield takeEvery(gamelogs_actions.LOAD_PLAYERS_GAMELOGS, load)
}

//= ====================================
//  ROOT
// -------------------------------------

export const gamelog_sagas = [
  fork(watch_load_matchups),
  fork(watch_load_player_gamelogs)
]
