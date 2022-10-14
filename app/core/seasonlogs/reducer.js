import { Map } from 'immutable'

import { seasonlogsActions } from './actions'

const initialState = new Map({
  nfl_teams: new Map()
})

export function seasonlogsReducer(state = initialState, { payload, type }) {
  switch (type) {
    case seasonlogsActions.GET_NFL_TEAM_SEASONLOGS_FULFILLED:
      return state.withMutations((state) => {
        payload.data.forEach(({ tm, stat_key, ...seasonlog }) => {
          state.setIn(['nfl_teams', tm, stat_key], seasonlog)
        })
      })

    default:
      return state
  }
}
