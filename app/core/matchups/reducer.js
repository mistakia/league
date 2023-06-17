import { Map, List } from 'immutable'

import { matchupsActions } from './actions'
import { teamActions } from '@core/teams'
import { constants, groupBy } from '@libs-shared'
import { createMatchup } from './matchup'

const initialState = new Map({
  isPending: false,
  selected: null,
  items: new List(),
  teams: new List(),
  weeks: new List(constants.weeks),
  playoffs: new List()
})

export function matchupsReducer(state = initialState, { payload, type }) {
  switch (type) {
    case matchupsActions.SELECT_MATCHUP:
      return state.merge({ selected: payload.matchupId })

    case matchupsActions.GET_MATCHUPS_FAILED:
      return state.merge({ isPending: false })

    case matchupsActions.GET_MATCHUPS_PENDING:
      return state.merge({ isPending: true })

    case teamActions.GET_TEAMS_FULFILLED:
      return state.merge({
        teams: new List(payload.data.teams.map((t) => t.uid))
      })

    case matchupsActions.GET_MATCHUPS_FULFILLED: {
      return state.withMutations((state) => {
        const matchups = payload.data.matchups.map((m) =>
          createMatchup({
            ...m,
            tids: [m.hid, m.aid],
            type: constants.matchups.H2H
          })
        )
        state.merge({
          items: new List(matchups),
          isPending: false
        })

        const playoffs = groupBy(payload.data.playoffs, 'uid')
        for (const gid in playoffs) {
          const tids = playoffs[gid].map((p) => p.tid)
          state.updateIn(['playoffs'], (arr) =>
            arr.push(
              createMatchup({
                tids,
                type: constants.matchups.TOURNAMENT,
                ...playoffs[gid][0]
              })
            )
          )
        }
      })
    }

    case matchupsActions.FILTER_MATCHUPS:
      return state.merge({
        [payload.type]: new List(payload.values)
      })

    default:
      return state
  }
}
