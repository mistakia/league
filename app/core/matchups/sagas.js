import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { app_actions } from '@core/app'
import { api_get_matchups, api_post_matchups } from '@core/api'
import {
  get_app,
  get_request_history,
  get_matchups_state,
  get_scoreboard
} from '@core/selectors'
import { is_league_post_season_week } from '@libs-shared'
import { current_season } from '@constants'
import { matchups_actions } from './actions'
import { scoreboard_actions } from '@core/scoreboard'

export function* load_matchups() {
  const { leagueId, year } = yield select(get_app)

  const request_history = yield select(get_request_history)
  const key = `GET_MATCHUPS_LEAGUE_${leagueId}_${year}`
  if (!request_history.has(key)) {
    yield call(api_get_matchups, { leagueId, year })
  } else {
    yield call(select_matchup)
  }
}

export function* generate({ payload }) {
  yield call(api_post_matchups, payload)
}

export function* select_matchup() {
  const state = yield select(get_matchups_state)

  console.log(`selected: ${state.get('selected')}`)
  if (state.get('selected')) {
    return
  }

  const { teamId, year } = yield select(get_app)
  const scoreboard = yield select(get_scoreboard)
  const week = scoreboard.get('week')

  console.log(`week: ${week}`)

  // TODO temp fix for 2020 season
  if (year === 2020 && week > 16) {
    yield put(scoreboard_actions.select_week(16))
    return
  }

  const is_post_season_week = is_league_post_season_week({ year, week })
  console.log(`is_post_season_week: ${is_post_season_week}`)

  if (year === current_season.week && is_post_season_week) {
    yield put(scoreboard_actions.select_week(current_season.week))
    return
  }

  if (is_post_season_week) {
    const playoffs = state.get('playoffs')
    const filtered = playoffs.filter((m) => m.week === week && m.year === year)
    const matchup = teamId
      ? filtered.find((m) => m.tids.includes(teamId))
      : filtered.first()
    const first = filtered.first()
    console.log(`matchup: ${matchup}`)
    console.log(`first: ${first}`)
    if (matchup || first) {
      const uid = matchup ? matchup.uid : first.uid
      yield put(matchups_actions.select_matchup({ matchupId: uid }))
    }
  } else {
    const matchups = state.get('matchups_by_id').toList()
    const matchup = teamId
      ? matchups.find(
          (m) => m.tids.includes(teamId) && m.week === week && m.year === year
        )
      : matchups.first()
    console.log(`matchup: ${matchup}`)
    if (matchup) {
      yield put(matchups_actions.select_matchup({ matchupId: matchup.uid }))
    }
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watch_generate_matchups() {
  yield takeLatest(matchups_actions.GENERATE_MATCHUPS, generate)
}

export function* watch_get_matchups_fulfilled() {
  yield takeLatest(matchups_actions.GET_MATCHUPS_FULFILLED, select_matchup)
}

export function* watch_scoreboard_select_week() {
  yield takeLatest(scoreboard_actions.SCOREBOARD_SELECT_WEEK, select_matchup)
}

export function* watch_load_matchups() {
  yield takeLatest(matchups_actions.LOAD_MATCHUPS, load_matchups)
}

export function* watch_select_year() {
  yield takeLatest(app_actions.SELECT_YEAR, load_matchups)
}

//= ====================================
//  ROOT
// -------------------------------------

export const matchup_sagas = [
  fork(watch_get_matchups_fulfilled),
  fork(watch_generate_matchups),
  fork(watch_scoreboard_select_week),
  fork(watch_load_matchups),
  fork(watch_select_year)
]
