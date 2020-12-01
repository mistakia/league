import { Record, List } from 'immutable'
import SHA256 from 'crypto-js/sha256'
import Bugsnag from '@bugsnag/js'

import { DEFAULT_LEAGUE_ID } from '@core/constants'
import { appActions } from './actions'
import { settingActions } from '@core/settings'
import { standingsActions } from '@core/standings'

const initialState = new Record({
  token: null,
  key: null,
  userId: undefined,
  teamId: undefined,
  leagueId: DEFAULT_LEAGUE_ID,
  isPending: true,
  isUpdating: false,
  authError: null,
  vorpw: null,
  volsw: null,
  email: null,
  vbaseline: 'starter',
  text: 0,
  voice: 0,
  teamIds: new List(),
  leagueIds: new List([DEFAULT_LEAGUE_ID]),
  teamPercentiles: {}
})

export function appReducer (state = initialState(), { payload, type }) {
  switch (type) {
    case appActions.INIT_APP:
      return state.merge({
        token: payload.token,
        key: payload.key,
        isPending: !!(payload.token && payload.key)
      })

    case appActions.LOGOUT:
      return initialState().merge({ isPending: false })

    case appActions.AUTH_FAILED:
      return state.merge({
        isPending: false
      })

    case standingsActions.SET_STANDINGS:
      return state.merge({ teamPercentiles: payload.percentiles })

    case appActions.AUTH_FULFILLED:
      Bugsnag.setUser(payload.data.user.id, payload.data.user.email)
      return state.merge({
        leagueId: payload.data.leagues.length ? payload.data.leagues[0].uid : undefined,
        teamId: payload.data.teams.length ? payload.data.teams[0].uid : undefined,
        userId: payload.data.user.id,
        vorpw: payload.data.user.vorpw,
        volsw: payload.data.user.volsw,
        vbaseline: payload.data.user.vbaseline,
        email: payload.data.user.eamil,
        text: payload.data.user.text,
        voice: payload.data.user.voice,
        teamIds: new List(payload.data.teams.map(t => t.uid)),
        leagueIds: new List(payload.data.leagues.map(l => l.uid)),
        isPending: false
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
        key: SHA256(`${payload.data.userId}${payload.opts.password}`).toString(),
        token: payload.data.token
      })

    case settingActions.SET_SETTING:
    case settingActions.PUT_SETTING_FULFILLED:
      return state.merge({ [payload.opts.type]: payload.data ? payload.data.value : payload.opts.value })

    default:
      return state
  }
}
