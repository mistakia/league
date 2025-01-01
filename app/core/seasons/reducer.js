import { Map } from 'immutable'

import { appActions } from '@core/app'
import { leagueActions } from '@core/leagues/actions'
import { seasons_actions } from './actions'
import { create_season } from './season'

const initial_state = new Map()

export function seasons_reducer(state = initial_state, { payload, type }) {
  switch (type) {
    case appActions.AUTH_FULFILLED:
      return state.withMutations((state) => {
        payload.data.leagues.forEach((league) => {
          state.setIn([league.uid, league.year], create_season(league))
        })
      })

    case leagueActions.GET_LEAGUE_FULFILLED: {
      return state.setIn(
        [payload.data.uid, payload.data.year],
        create_season(payload.data)
      )
    }

    case seasons_actions.GET_SEASON_FULFILLED: {
      return state.setIn(
        [payload.data.uid, payload.data.year],
        create_season(payload.data)
      )
    }

    default:
      return state
  }
}
