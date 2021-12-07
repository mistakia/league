import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { getApp, appActions } from '@core/app'
import { fetchMatchups, postMatchups } from '@core/api'
import { constants } from '@common'
import { matchupsActions } from './actions'
import { getMatchups } from './selectors'
import { getScoreboard, scoreboardActions } from '@core/scoreboard'

export function* loadMatchups() {
  const { leagueId } = yield select(getApp)
  yield call(fetchMatchups, { leagueId })
}

export function* generate({ payload }) {
  yield call(postMatchups, payload)
}

export function* selectMatchup() {
  const state = yield select(getMatchups)
  const { teamId } = yield select(getApp)
  const scoreboard = yield select(getScoreboard)
  const week = scoreboard.get('week')
  if (week <= constants.season.regularSeasonFinalWeek) {
    const matchups = state.get('items')
    const matchup = matchups.find(
      (m) => m.tids.includes(teamId) && m.week === week
    )
    if (matchup) {
      yield put(matchupsActions.select(matchup.uid))
    }
  } else {
    const playoffs = state.get('playoffs')
    const filtered = playoffs.filter((m) => m.week === week)
    const matchup = filtered.find((m) => m.tids.includes(teamId))
    const first = filtered.first()
    if (matchup || first) {
      const uid = matchup ? matchup.uid : first.uid
      yield put(matchupsActions.select(uid))
    }
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchGenerateMatchups() {
  yield takeLatest(matchupsActions.GENERATE_MATCHUPS, generate)
}

export function* watchAuthFulfilled() {
  yield takeLatest(appActions.AUTH_FULFILLED, loadMatchups)
}

export function* watchGetMatchupsFulfilled() {
  yield takeLatest(matchupsActions.GET_MATCHUPS_FULFILLED, selectMatchup)
}

export function* watchScoreboardSelectWeek() {
  yield takeLatest(scoreboardActions.SCOREBOARD_SELECT_WEEK, selectMatchup)
}

//= ====================================
//  ROOT
// -------------------------------------

export const matchupSagas = [
  fork(watchAuthFulfilled),
  fork(watchGetMatchupsFulfilled),
  fork(watchGenerateMatchups),
  fork(watchScoreboardSelectWeek)
]
