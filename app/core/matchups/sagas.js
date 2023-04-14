import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { getApp } from '@core/app'
import { fetchMatchups, postMatchups, getRequestHistory } from '@core/api'
import { constants } from '@common'
import { matchupsActions } from './actions'
import { getMatchups } from './selectors'
import { getScoreboard, scoreboardActions } from '@core/scoreboard'

export function* loadMatchups() {
  const { leagueId, year } = yield select(getApp)

  const request_history = yield select(getRequestHistory)
  const key = `GET_MATCHUPS_${leagueId}_${year}`
  if (!request_history.has(key)) {
    yield call(fetchMatchups, { leagueId, year })
  }
}

export function* generate({ payload }) {
  yield call(postMatchups, payload)
}

export function* selectMatchup() {
  const state = yield select(getMatchups)
  const { teamId, year } = yield select(getApp)
  const scoreboard = yield select(getScoreboard)
  const week = scoreboard.get('week')
  if (week <= constants.season.regularSeasonFinalWeek) {
    const matchups = state.get('items')
    const matchup = teamId
      ? matchups.find(
          (m) => m.tids.includes(teamId) && m.week === week && m.year === year
        )
      : matchups.first()
    if (matchup) {
      yield put(matchupsActions.select(matchup.uid))
    }
  } else {
    const playoffs = state.get('playoffs')
    const filtered = playoffs.filter((m) => m.week === week && m.year === year)
    const matchup = teamId
      ? filtered.find((m) => m.tids.includes(teamId))
      : filtered.first()
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

export function* watchGetMatchupsFulfilled() {
  yield takeLatest(matchupsActions.GET_MATCHUPS_FULFILLED, selectMatchup)
}

export function* watchScoreboardSelectWeek() {
  yield takeLatest(scoreboardActions.SCOREBOARD_SELECT_WEEK, selectMatchup)
}

export function* watchLoadMatchups() {
  yield takeLatest(matchupsActions.LOAD_MATCHUPS, loadMatchups)
}

//= ====================================
//  ROOT
// -------------------------------------

export const matchupSagas = [
  fork(watchGetMatchupsFulfilled),
  fork(watchGenerateMatchups),
  fork(watchScoreboardSelectWeek),
  fork(watchLoadMatchups)
]
