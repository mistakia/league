import { Map, Record } from 'immutable'

import { appActions } from '@core/app'
import { leagueActions } from '@core/leagues/actions'

const initial_state = new Map()

const Season = new Record({
  wildcard_round: null,
  championship_round: null
})

const create_season = ({ wildcard_round, championship_round }) =>
  new Season({
    wildcard_round,
    championship_round
  })

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

    default:
      return state
  }
}
