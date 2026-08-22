import { call, takeLatest, fork, put } from 'redux-saga/effects'

import { contribution_actions } from './actions'
import {
  api_post_contribution,
  api_get_contributions,
  api_get_contribution,
  api_post_contribution_answer
} from '@core/api'
import { notification_actions } from '@core/notifications'

export function* submit_contribution({ payload }) {
  yield call(api_post_contribution, payload)
}

export function* load_contributions() {
  yield call(api_get_contributions)
}

export function* load_contribution({ payload }) {
  yield call(api_get_contribution, payload)
}

export function* submit_contribution_answer({ payload }) {
  yield call(api_post_contribution_answer, payload)
}

// Only the SUCCESS branch is announced here. The failure branch already shows a
// toast and reports the error from fetch_api's generic handler (api/sagas.js),
// so raising one here as well would double-toast a single refusal.
export function* notify_submission_received() {
  yield put(
    notification_actions.show({
      severity: 'success',
      message: 'Report submitted — thank you'
    })
  )
}

export function* notify_answer_received() {
  yield put(
    notification_actions.show({
      severity: 'success',
      message: 'Answer submitted'
    })
  )
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watch_submit_contribution() {
  yield takeLatest(
    contribution_actions.SUBMIT_CONTRIBUTION,
    submit_contribution
  )
}

export function* watch_load_contributions() {
  yield takeLatest(contribution_actions.LOAD_CONTRIBUTIONS, load_contributions)
}

export function* watch_load_contribution() {
  yield takeLatest(contribution_actions.LOAD_CONTRIBUTION, load_contribution)
}

export function* watch_submit_contribution_answer() {
  yield takeLatest(
    contribution_actions.SUBMIT_CONTRIBUTION_ANSWER,
    submit_contribution_answer
  )
}

export function* watch_post_contribution_fulfilled() {
  yield takeLatest(
    contribution_actions.POST_CONTRIBUTION_FULFILLED,
    notify_submission_received
  )
}

export function* watch_post_contribution_answer_fulfilled() {
  yield takeLatest(
    contribution_actions.POST_CONTRIBUTION_ANSWER_FULFILLED,
    notify_answer_received
  )
}

//= ====================================
//  ROOT
// -------------------------------------

export const contribution_sagas = [
  fork(watch_submit_contribution),
  fork(watch_load_contributions),
  fork(watch_load_contribution),
  fork(watch_submit_contribution_answer),
  fork(watch_post_contribution_fulfilled),
  fork(watch_post_contribution_answer_fulfilled)
]
