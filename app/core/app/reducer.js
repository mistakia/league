import { Record, List } from 'immutable'
import { set_user as set_error_user } from '@core/bugsnag'

import { app_actions } from './actions'
import { setting_actions } from '@core/settings/actions'
import { uuidv4 } from '#libs-shared'
import { current_season, league_defaults } from '#constants'
import { roster_actions } from '@core/rosters/actions'
import { team_actions } from '@core/teams/actions'
import { matchups_actions } from '@core/matchups/actions'
import { data_views_actions } from '@core/data-views/actions'
import { default_data_view_view_id } from '@core/data-views/default-data-views'
import { plays_views_actions } from '@core/plays-view/actions'
import { default_plays_view_view_id } from '@core/plays-view/default-plays-views'
import { create_user_record, User } from './user'

const initialState = new Record({
  token: null,
  user: new User(),
  userId: 0,
  clientId: uuidv4(),
  year: current_season.year,
  teamId: undefined,
  leagueId: league_defaults.LEAGUE_ID,
  isPending: true,
  isUpdating: false,
  authError: null,
  is_password_reset: false,
  is_password_reset_requested: false,
  teamIds: new List(),
  leagueIds: new List([league_defaults.LEAGUE_ID]),
  selected_data_view_id: default_data_view_view_id,
  selected_plays_view_id: default_plays_view_view_id,

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

    // Resolve the viewing team from the league actually on screen.
    //
    // AUTH_FULFILLED can only adopt a teamId when the route's league is the
    // user's FIRST one, so a manager in more than one league had no team in any
    // other league and every team-scoped surface silently rendered as if they
    // owned nothing. This is the payload that knows the answer: it carries the
    // teams of the league in view, and `teamIds` carries the ones the user owns.
    //
    // The auction page is where it bit first. Its elections fetch is gated on
    // teamId, so the request was never issued at all and the standing-elections
    // panel rendered "No elections yet" -- which, as this design keeps saying,
    // is indistinguishable from a manager who chose not to elect.
    case team_actions.GET_TEAMS_FULFILLED:
      return state.withMutations((state) => {
        const teamId = state.get('teamId')
        if (payload.data.teams.some((t) => t.team_id === teamId)) return

        const owned_team_ids = state.get('teamIds')
        const owned = payload.data.teams.find((t) =>
          owned_team_ids.includes(t.team_id)
        )
        state.set('teamId', owned ? owned.team_id : null)
      })

    // teamId belongs to the league it was resolved in, so a league change must
    // drop it rather than render another league's team. This matches what a
    // full page load of the new league's URL does: AUTH_FULFILLED only adopts a
    // teamId when the route's league is the user's first one.
    case app_actions.SELECT_LEAGUE: {
      const leagueId = payload.leagueId
      if (leagueId === state.get('leagueId')) return state
      return state.merge({ leagueId, teamId: undefined })
    }

    case app_actions.LOGOUT:
      return initialState().merge({ isPending: false })

    case app_actions.AUTH_FAILED:
      return state.merge({
        isPending: false
      })

    case app_actions.AUTH_FULFILLED:
      set_error_user(payload.data.user.id)
      return state.withMutations((state) => {
        const currentLeagueId = state.get('leagueId')
        const leagueNotSet = !currentLeagueId

        const leagueId = payload.data.leagues.length
          ? payload.data.leagues[0].league_id
          : undefined
        if (leagueNotSet && leagueId) {
          state.set('leagueId', leagueId)
        }

        const teamId = payload.data.teams.length
          ? payload.data.teams[0].team_id
          : undefined
        if ((leagueNotSet || currentLeagueId === leagueId) && teamId) {
          state.set('teamId', teamId)
        }

        state.merge({
          userId: payload.data.user.id,
          user: create_user_record(payload.data.user),
          teamIds: new List(payload.data.teams.map((t) => t.team_id)),
          leagueIds: new List(payload.data.leagues.map((l) => l.league_id)),
          isPending: false
        })
      })

    case app_actions.RESET_PASSWORD_PENDING:
      return state.merge({
        isUpdating: true,
        authError: null,
        is_password_reset: false
      })

    case app_actions.RESET_PASSWORD_FULFILLED:
      return state.merge({
        isUpdating: false,
        authError: null,
        is_password_reset: true
      })

    case app_actions.RESET_PASSWORD_FAILED:
      return state.merge({
        isUpdating: false,
        authError: payload.error,
        is_password_reset: false
      })

    case app_actions.REQUEST_PASSWORD_RESET_PENDING:
      return state.merge({
        isUpdating: true,
        authError: null,
        is_password_reset_requested: false
      })

    // The API answers identically for a known and an unknown account, and the
    // UI must not leak the difference either — so FULFILLED carries no data
    // and the page renders one generic acknowledgement for both.
    case app_actions.REQUEST_PASSWORD_RESET_FULFILLED:
      return state.merge({
        isUpdating: false,
        authError: null,
        is_password_reset_requested: true
      })

    case app_actions.REQUEST_PASSWORD_RESET_FAILED:
      return state.merge({
        isUpdating: false,
        authError: payload.error,
        is_password_reset_requested: false
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

    case plays_views_actions.SET_SELECTED_PLAYS_VIEW:
      return state.merge({
        selected_plays_view_id: payload.data_view_id
      })

    case plays_views_actions.POST_PLAYS_VIEW_FULFILLED:
      if (
        payload.opts.client_generated_view_id ===
          state.get('selected_plays_view_id') &&
        payload.data.view_id !== payload.opts.client_generated_view_id
      ) {
        return state.set('selected_plays_view_id', payload.data.view_id)
      }
      return state

    case plays_views_actions.PLAYS_VIEW_CHANGED:
      if (
        payload.view_change_params &&
        payload.view_change_params.view_state_changed
      ) {
        return state.merge({
          selected_plays_view_id: payload.data_view.view_id
        })
      }
      return state

    default:
      return state
  }
}
