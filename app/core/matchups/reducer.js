import { Map, List } from 'immutable'

import { matchups_actions } from './actions'
import { team_actions } from '@core/teams'
import { app_actions } from '@core/app'
import { scoreboard_actions } from '@core/scoreboard'
import { groupBy } from '@libs-shared'
import { regular_fantasy_weeks, matchup_types } from '@constants'
import { create_matchup } from './matchup'

const initialState = new Map({
  isPending: false,
  selected: null,
  matchups_by_id: new Map(),
  teams: new List(),
  weeks: new List(regular_fantasy_weeks),
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
        teams: new List(payload.data.teams.map((t) => t.team_id))
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
            tids: [m.home_team_id, m.away_team_id],
            type: matchup_types.H2H,
            points: [m.home_points, m.away_points],
            projections: [m.home_projection, m.away_projection]
          })
          state.setIn(['matchups_by_id', m.matchup_id], matchup)
        })

        state.merge({
          isPending: false
        })

        const playoffs = groupBy(payload.data.playoffs, 'playoff_week_number')
        for (const playoff_week_number in playoffs) {
          const rows = playoffs[playoff_week_number]
          const tids = rows.map((p) => p.tid)
          const points = rows.map((p) => p.points)
          const points_manual = rows.map((p) => p.points_manual)
          const projections = rows.map((p) => p.projection)
          state.updateIn(['playoffs'], (arr) =>
            arr.push(
              create_matchup({
                ...rows[0],
                // `playoff_week_number` rides in on the spread and the Record
                // declares it, so a tournament entry keeps its own identity
                // rather than borrowing the matchup id field. It carries no
                // matchup id at all, which is the point.
                playoff_week_number: Number(playoff_week_number),
                tids,
                type: matchup_types.TOURNAMENT,
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
