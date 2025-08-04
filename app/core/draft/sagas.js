import dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { app_actions } from '@core/app'
import {
  get_app,
  get_draft_state,
  get_rookie_draft_next_pick,
  get_current_league
} from '@core/selectors'
import { draft_actions } from './actions'
import {
  api_get_draft,
  api_post_draft,
  api_get_players,
  api_get_draft_pick_details
} from '@core/api'
import { constants } from '@libs-shared'

dayjs.extend(isBetween)

export function* load_draft() {
  const { leagueId } = yield select(get_app)
  yield call(api_get_draft, { leagueId })
}

export function* draft_player() {
  const { selected } = yield select(get_draft_state)
  const { teamId, leagueId } = yield select(get_app)
  const { uid } = yield select(get_rookie_draft_next_pick)
  const params = { leagueId, pid: selected, teamId, pickId: uid }
  yield call(api_post_draft, params)
}

export function* init() {
  const league = yield select(get_current_league)
  if (league.draft_start && constants.fantasy_season_week === 0) {
    yield call(api_get_draft, { leagueId: league.uid })
  }
}

export function* load_missing_players_from_pick_details({ payload }) {
  const { data } = payload
  const { historical_picks } = data

  if (historical_picks && historical_picks.length > 0) {
    // Extract player IDs from historical picks
    const player_ids = historical_picks
      .map((historical_pick) => historical_pick.pid)
      .filter(Boolean)

    if (player_ids.length > 0) {
      // Check which players are already loaded
      const players_state = yield select((state) => state.get('players'))
      const existing_players = players_state.get('items')
      const missing_player_ids = player_ids.filter(
        (pid) => !existing_players.has(pid)
      )

      if (missing_player_ids.length > 0) {
        const { leagueId } = yield select(get_app)
        yield call(api_get_players, { leagueId, pids: missing_player_ids })
      }
    }
  }
}

export function* load_draft_pick_details({ payload }) {
  const { pick_id } = payload
  const { leagueId } = yield select(get_app)

  // Check if pick details are already loaded
  const draft_state = yield select(get_draft_state)
  const existing_details = draft_state.getIn(['pick_details', pick_id])

  if (!existing_details || !existing_details.get('loaded')) {
    yield call(api_get_draft_pick_details, { leagueId, pickId: pick_id })
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watch_load_draft() {
  yield takeLatest(draft_actions.LOAD_DRAFT, load_draft)
}

export function* watch_draft_player() {
  yield takeLatest(draft_actions.DRAFT_PLAYER, draft_player)
}

export function* watch_auth_fulfilled() {
  yield takeLatest(app_actions.AUTH_FULFILLED, init)
}

export function* watch_get_draft_pick_details_fulfilled() {
  yield takeLatest(
    draft_actions.GET_DRAFT_PICK_DETAILS_FULFILLED,
    load_missing_players_from_pick_details
  )
}

export function* watch_load_draft_pick_details() {
  yield takeLatest(
    draft_actions.LOAD_DRAFT_PICK_DETAILS,
    load_draft_pick_details
  )
}

//= ====================================
//  ROOT
// -------------------------------------

export const draft_sagas = [
  fork(watch_load_draft),
  fork(watch_draft_player),
  fork(watch_auth_fulfilled),
  fork(watch_get_draft_pick_details_fulfilled),
  fork(watch_load_draft_pick_details)
]
