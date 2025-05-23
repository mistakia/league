import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { appActions } from '@core/app'
import { fetchMatchups, postMatchups } from '@core/api'
import {
  get_app,
  get_request_history,
  getMatchups,
  getScoreboard
} from '@core/selectors'
import { constants, is_league_post_season_week } from '@libs-shared'
import { matchupsActions } from './actions'
import { scoreboardActions } from '@core/scoreboard'

export function* loadMatchups() {
  const { leagueId, year } = yield select(get_app)

  const request_history = yield select(get_request_history)
  const key = `GET_MATCHUPS_LEAGUE_${leagueId}_${year}`
  if (!request_history.has(key)) {
    yield call(fetchMatchups, { leagueId, year })
  } else {
    yield call(selectMatchup)
  }
}

export function* generate({ payload }) {
  yield call(postMatchups, payload)
}

export function* selectMatchup() {
  const state = yield select(getMatchups)

  console.log(`selected: ${state.get('selected')}`)
  if (state.get('selected')) {
    return
  }

  const { teamId, year } = yield select(get_app)
  const scoreboard = yield select(getScoreboard)
  const week = scoreboard.get('week')

  console.log(`week: ${week}`)

  // TODO temp fix for 2020 season
  if (year === 2020 && week > 16) {
    yield put(scoreboardActions.selectWeek(16))
    return
  }

  const is_post_season_week = is_league_post_season_week({ year, week })
  console.log(`is_post_season_week: ${is_post_season_week}`)

  if (year === constants.week && is_post_season_week) {
    yield put(scoreboardActions.selectWeek(constants.week))
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
      yield put(matchupsActions.select_matchup({ matchupId: uid }))
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
      yield put(matchupsActions.select_matchup({ matchupId: matchup.uid }))
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

export function* watchSelectYear() {
  yield takeLatest(appActions.SELECT_YEAR, loadMatchups)
}

//= ====================================
//  ROOT
// -------------------------------------

export const matchupSagas = [
  fork(watchGetMatchupsFulfilled),
  fork(watchGenerateMatchups),
  fork(watchScoreboardSelectWeek),
  fork(watchLoadMatchups),
  fork(watchSelectYear)
]
