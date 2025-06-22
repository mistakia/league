import { Record, List } from 'immutable'
import Bugsnag from '@bugsnag/js'

import { appActions } from './actions'
import { settingActions } from '@core/settings'
import { constants, uuidv4 } from '@libs-shared'
import { roster_actions } from '@core/rosters'
import { teamActions } from '@core/teams'
import { matchupsActions } from '@core/matchups'
import { data_views_actions, default_data_view_view_id } from '@core/data-views'
import { create_user_record, User } from './user'

const initialState = new Record({
  token: null,
  user: new User(),
  userId: 0,
  clientId: uuidv4(),
  year: constants.year,
  teamId: undefined,
  leagueId: constants.DEFAULTS.LEAGUE_ID,
  isPending: true,
  isUpdating: false,
  authError: null,
  teamIds: new List(),
  leagueIds: new List([constants.DEFAULTS.LEAGUE_ID]),
  selected_data_view_id: default_data_view_view_id,

  isLoadingRosters: null,
  isLoadedRosters: null
})

export function appReducer(state = initialState(), { payload, type }) {
  switch (type) {
    case appActions.INIT_APP:
      return state.merge({
        token: payload.token,
        isPending: Boolean(payload.token),
        leagueId: payload.leagueId || state.leagueId
      })

    case roster_actions.GET_ROSTERS_PENDING:
      return state.set('isLoadingRosters', payload.opts.leagueId)

    case roster_actions.GET_ROSTERS_FAILED:
      return state.set('isLoadingRosters', null)

    case roster_actions.GET_ROSTERS_FULFILLED:
      return state.withMutations((state) => {
        state.set('isLoadingRosters', null)
        state.set('isLoadedRosters', payload.opts.leagueId)
      })

    case teamActions.GET_TEAMS_FULFILLED:
      return state.withMutations((state) => {
        const teamId = state.get('teamId')
        const team = payload.data.teams.find((t) => t.uid === teamId)
        if (!team) state.set('teamId', null)
      })

    case appActions.LOGOUT:
      return initialState().merge({ isPending: false })

    case appActions.AUTH_FAILED:
      return state.merge({
        isPending: false
      })

    case appActions.AUTH_FULFILLED:
      Bugsnag.setUser(payload.data.user.id, payload.data.user.email)
      return state.withMutations((state) => {
        const currentLeagueId = state.get('leagueId')
        const leagueNotSet = !currentLeagueId

        const leagueId = payload.data.leagues.length
          ? payload.data.leagues[0].uid
          : undefined
        if (leagueNotSet && leagueId) {
          state.set('leagueId', leagueId)
        }

        const teamId = payload.data.teams.length
          ? payload.data.teams[0].uid
          : undefined
        if ((leagueNotSet || currentLeagueId === leagueId) && teamId) {
          state.set('teamId', teamId)
        }

        state.merge({
          userId: payload.data.user.id,
          user: create_user_record(payload.data.user),
          teamIds: new List(payload.data.teams.map((t) => t.uid)),
          leagueIds: new List(payload.data.leagues.map((l) => l.uid)),
          isPending: false
        })
      })

    case appActions.REGISTER_FAILED:
    case appActions.LOGIN_FAILED:
      return state.merge({
        isUpdating: false,
        authError: payload.error
      })

    case appActions.REGISTER_PENDING:
    case appActions.LOGIN_PENDING:
      return state.merge({ isUpdating: true })

    case appActions.REGISTER_FULFILLED:
    case appActions.LOGIN_FULFILLED:
      return state.merge({
        isUpdating: false,
        token: payload.data.token
      })

    case settingActions.SET_SETTING:
    case settingActions.PUT_SETTING_FULFILLED:
      return state.merge({
        [payload.opts.type]: payload.data
          ? payload.data.value
          : payload.opts.value
      })

    case appActions.SELECT_YEAR:
      return state.merge({
        year: payload.year
      })

    case matchupsActions.SELECT_MATCHUP:
      if (payload.year === null || payload.year === undefined) {
        return state
      }

      return state.merge({
        year: payload.year
      })

    case data_views_actions.SET_SELECTED_DATA_VIEW:
      return state.merge({
        selected_data_view_id: payload.data_view_id
      })

    case data_views_actions.POST_DATA_VIEW_FULFILLED:
      if (
        payload.opts.client_generated_view_id ===
          state.get('selected_data_view_id') &&
        payload.data.view_id !== payload.opts.client_generated_view_id
      ) {
        return state.set('selected_data_view_id', payload.data.view_id)
      }
      return state

    case data_views_actions.DATA_VIEW_CHANGED:
      return state.merge({
        selected_data_view_id: payload.data_view.view_id
      })

    default:
      return state
  }
}
