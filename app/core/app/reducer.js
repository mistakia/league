import { Record, List } from 'immutable'
import Bugsnag from '@bugsnag/js'

import { appActions } from './actions'
import { settingActions } from '@core/settings'
import { constants } from '@common'
import { rosterActions } from '@core/rosters'
import { teamActions } from '@core/teams'

const initialState = new Record({
  token: null,
  userId: undefined,
  teamId: undefined,
  leagueId: constants.DEFAULTS.LEAGUE_ID,
  isPending: true,
  isUpdating: false,
  authError: null,
  email: null,
  text: 0,
  voice: 0,
  teamIds: new List(),
  leagueIds: new List([constants.DEFAULTS.LEAGUE_ID])
})

export function appReducer(state = initialState(), { payload, type }) {
  switch (type) {
    case appActions.INIT_APP:
      return state.merge({
        token: payload.token,
        isPending: Boolean(payload.token),
        leagueId: payload.leagueId,
        leagueIds: new List([payload.leagueId])
      })

    case rosterActions.GET_ROSTERS_PENDING:
      return state.set('isLoadingRosters', payload.opts.leagueId)

    case rosterActions.GET_ROSTERS_FAILED:
      return state.delete('isLoadingRosters')

    case rosterActions.GET_ROSTERS_FULFILLED:
      return state.withMutations((state) => {
        state.delete('isLoadingRosters')
        state.set('isLoadedRosters', payload.opts.leagueId)
      })

    case teamActions.GET_TEAMS_PENDING:
      return state.set('isLoadingTeams', payload.opts.leagueId)

    case teamActions.GET_TEAMS_FAILED:
      return state.delete('isLoadingTeams')

    case teamActions.GET_TEAMS_FULFILLED:
      return state.withMutations((state) => {
        const teamId = state.get('teamId')
        const team = payload.data.teams.find((t) => t.uid === teamId)
        if (!team) state.set('teamId', null)
        state.delete('isLoadingTeams')
        state.set('isLoadedTeams', payload.opts.leagueId)
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
        const leagueNotSet = !state.get('leagueId')

        const leagueId = payload.data.leagues.length
          ? payload.data.leagues[0].uid
          : undefined
        if (leagueNotSet && leagueId) {
          state.set('leagueId', leagueId)
        }

        const teamId = payload.data.teams.length
          ? payload.data.teams[0].uid
          : undefined
        if (leagueNotSet && teamId) {
          state.set('teamId', teamId)
        }

        state.merge({
          userId: payload.data.user.id,
          email: payload.data.user.eamil,
          text: payload.data.user.text,
          voice: payload.data.user.voice,
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

    default:
      return state
  }
}
