import { Record, List } from 'immutable'
import Bugsnag from '@bugsnag/js'

import { appActions } from './actions'
import { settingActions } from '@core/settings'
import { constants } from '@common'
import { rosterActions } from '@core/rosters'
import { teamActions } from '@core/teams'

const initialState = new Record({
  token: null,
  userId: 0,
  year: constants.year,
  teamId: undefined,
  leagueId: constants.DEFAULTS.LEAGUE_ID,
  isPending: true,
  isUpdating: false,
  authError: null,
  email: null,
  text: 0,
  voice: 0,
  teamIds: new List(),
  leagueIds: new List([constants.DEFAULTS.LEAGUE_ID]),

  isLoadingRosters: null,
  isLoadedRosters: null,
  isLoadingTeams: null,
  isLoadedTeams: null
})

export function appReducer(state = initialState(), { payload, type }) {
  switch (type) {
    case appActions.INIT_APP:
      return state.merge({
        token: payload.token,
        isPending: Boolean(payload.token),
        leagueId: payload.leagueId
      })

    case rosterActions.GET_ROSTERS_PENDING:
      return state.set('isLoadingRosters', payload.opts.leagueId)

    case rosterActions.GET_ROSTERS_FAILED:
      return state.set('isLoadingRosters', null)

    case rosterActions.GET_ROSTERS_FULFILLED:
      return state.withMutations((state) => {
        state.set('isLoadingRosters', null)
        state.set('isLoadedRosters', payload.opts.leagueId)
      })

    case teamActions.GET_TEAMS_PENDING:
      return state.set('isLoadingTeams', payload.opts.leagueId)

    case teamActions.GET_TEAMS_FAILED:
      return state.set('isLoadingTeams', null)

    case teamActions.GET_TEAMS_FULFILLED:
      return state.withMutations((state) => {
        const teamId = state.get('teamId')
        const team = payload.data.teams.find((t) => t.uid === teamId)
        if (!team) state.set('teamId', null)
        state.set('isLoadingTeams', null)
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

    case appActions.SELECT_YEAR:
      return state.merge({
        year: payload.year
      })

    default:
      return state
  }
}
