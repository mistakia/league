import { Map, List } from 'immutable'

import { matchups_actions } from './actions'
import { team_actions } from '@core/teams'
import { app_actions } from '@core/app'
import { scoreboard_actions } from '@core/scoreboard'
import { constants, groupBy } from '@libs-shared'
import { create_matchup } from './matchup'

const initialState = new Map({
  isPending: false,
  selected: null,
  matchups_by_id: new Map(),
  teams: new List(),
  weeks: new List(constants.weeks),
  playoffs: new List()
})

export function matchups_reducer(state = initialState, { payload, type }) {
  switch (type) {
    case matchups_actions.SELECT_MATCHUP:
      return state.merge({ selected: payload.matchupId })

    case matchups_actions.GET_MATCHUPS_FAILED:
      return state.merge({ isPending: false })

    case matchups_actions.GET_MATCHUPS_PENDING:
      return state.merge({ isPending: true })

    case team_actions.GET_TEAMS_FULFILLED:
      return state.merge({
        teams: new List(payload.data.teams.map((t) => t.uid))
      })

    case scoreboard_actions.SCOREBOARD_SELECT_WEEK:
    case app_actions.SELECT_YEAR:
      return state.merge({
        selected: null
      })

    case matchups_actions.GET_MATCHUPS_FULFILLED: {
      return state.withMutations((state) => {
        payload.data.matchups.forEach((m) => {
          const matchup = create_matchup({
            ...m,
            tids: [m.hid, m.aid],
            type: constants.matchups.H2H,
            points: [m.hp, m.ap],
            projections: [m.home_projection, m.away_projection]
          })
          state.setIn(['matchups_by_id', m.uid], matchup)
        })

        state.merge({
          isPending: false
        })

        const playoffs = groupBy(payload.data.playoffs, 'uid')
        for (const gid in playoffs) {
          const tids = playoffs[gid].map((p) => p.tid)
          const points = playoffs[gid].map((p) => p.points)
          const points_manual = playoffs[gid].map((p) => p.points_manual)
          const projections = playoffs[gid].map((p) => p.projection)
          state.updateIn(['playoffs'], (arr) =>
            arr.push(
              create_matchup({
                ...playoffs[gid][0],
                tids,
                type: constants.matchups.TOURNAMENT,
                points,
                points_manual,
                projections
              })
            )
          )
        }
      })
    }

    case matchups_actions.FILTER_MATCHUPS:
      return state.merge({
        [payload.type]: new List(payload.values)
      })

    default:
      return state
  }
}
