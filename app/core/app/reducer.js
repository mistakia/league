import { Record, List } from 'immutable'
import Bugsnag from '@bugsnag/js'

import { appActions } from './actions'
import { settingActions } from '@core/settings'
import { constants } from '@common'
import { rosterActions } from '@core/rosters'
import { transactionsActions } from '@core/transactions'
import { waiverActions } from '@core/waivers'
import { teamActions } from '@core/teams'
import { matchupsActions } from '@core/matchups'

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
        isPending: Boolean(payload.token)
      })

    case appActions.LOGOUT:
      return initialState().merge({ isPending: false })

    case appActions.AUTH_FAILED:
      return state.merge({
        isPending: false
      })

    case appActions.AUTH_FULFILLED:
      Bugsnag.setUser(payload.data.user.id, payload.data.user.email)
      return state.merge({
        leagueId: payload.data.leagues.length
          ? payload.data.leagues[0].uid
          : undefined,
        teamId: payload.data.teams.length
          ? payload.data.teams[0].uid
          : undefined,
        userId: payload.data.user.id,
        email: payload.data.user.eamil,
        text: payload.data.user.text,
        voice: payload.data.user.voice,
        teamIds: new List(payload.data.teams.map((t) => t.uid)),
        leagueIds: new List(payload.data.leagues.map((l) => l.uid)),
        isPending: false
      })

    case transactionsActions.LOAD_TRANSACTIONS:
    case rosterActions.LOAD_ROSTERS:
    case waiverActions.LOAD_WAIVERS:
    case teamActions.LOAD_LEAGUE_TEAM_STATS:
    case matchupsActions.LOAD_MATCHUPS:
      return state.merge({
        leagueId: Number(payload.leagueId)
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
