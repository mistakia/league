import { Record, List } from 'immutable'
import Bugsnag from '@bugsnag/js'

import { app_actions } from './actions'
import { setting_actions } from '@core/settings'
import { constants, uuidv4 } from '@libs-shared'
import { roster_actions } from '@core/rosters'
import { team_actions } from '@core/teams'
import { matchups_actions } from '@core/matchups'
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

  is_loading_rosters: null,
  is_loaded_rosters: null
})

export function app_reducer(state = initialState(), { payload, type }) {
  switch (type) {
    case app_actions.INIT_APP:
      return state.merge({
        token: payload.token,
        isPending: Boolean(payload.token),
        leagueId: payload.leagueId || state.leagueId
      })

    case roster_actions.GET_ROSTERS_PENDING:
      return state.set('is_loading_rosters', payload.opts.leagueId)

    case roster_actions.GET_ROSTERS_FAILED:
      return state.set('is_loading_rosters', null)

    case roster_actions.GET_ROSTERS_FULFILLED:
      return state.withMutations((state) => {
        state.set('is_loading_rosters', null)
        state.set('is_loaded_rosters', payload.opts.leagueId)
      })

    case team_actions.GET_TEAMS_FULFILLED:
      return state.withMutations((state) => {
        const teamId = state.get('teamId')
        const team = payload.data.teams.find((t) => t.uid === teamId)
        if (!team) state.set('teamId', null)
      })

    case app_actions.LOGOUT:
      return initialState().merge({ isPending: false })

    case app_actions.AUTH_FAILED:
      return state.merge({
        isPending: false
      })

    case app_actions.AUTH_FULFILLED:
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

    case app_actions.REGISTER_FAILED:
    case app_actions.LOGIN_FAILED:
      return state.merge({
        isUpdating: false,
        authError: payload.error
      })

    case app_actions.REGISTER_PENDING:
    case app_actions.LOGIN_PENDING:
      return state.merge({ isUpdating: true })

    case app_actions.REGISTER_FULFILLED:
    case app_actions.LOGIN_FULFILLED:
      return state.merge({
        isUpdating: false,
        token: payload.data.token
      })

    case setting_actions.SET_SETTING:
    case setting_actions.PUT_SETTING_FULFILLED:
      return state.merge({
        [payload.opts.type]: payload.data
          ? payload.data.value
          : payload.opts.value
      })

    case app_actions.SELECT_YEAR:
      return state.merge({
        year: payload.year
      })

    case matchups_actions.SELECT_MATCHUP:
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
      // Only update selected view if view_state_changed is true
      // This prevents browser state restoration from changing the selected view
      if (
        payload.view_change_params &&
        payload.view_change_params.view_state_changed
      ) {
        return state.merge({
          selected_data_view_id: payload.data_view.view_id
        })
      }
      return state

    default:
      return state
  }
}
