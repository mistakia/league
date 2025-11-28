import { Map } from 'immutable'

import { app_actions } from '@core/app'
import { createTeam } from './team'
import { team_actions } from './actions'
import { auction_actions } from '@core/auction'
import { draft_actions } from '@core/draft'
import { trade_actions } from '@core/trade'
import { current_season } from '@constants'

const initialState = new Map()

export function teams_reducer(state = initialState, { payload, type }) {
  switch (type) {
    case app_actions.AUTH_FULFILLED:
    case team_actions.GET_TEAMS_FULFILLED:
      return state.withMutations((state) => {
        const year = payload.opts.year || current_season.year
        payload.data.teams.forEach((t) => {
          if (state.hasIn([year, t.uid])) {
            if (t.stats) {
              state.setIn(
                [year, t.uid],
                state.getIn([year, t.uid]).mergeDeep(createTeam(t))
              )
            } else {
              let new_team = state.getIn([year, t.uid]).merge(createTeam(t))
              const existing_stats = state.getIn([year, t.uid]).get('stats')
              const new_stats = new_team.get('stats')

              // Merge existing stats with new stats, using truthy values
              const merged_stats = existing_stats.mergeWith(
                (existing, new_val) => existing || new_val,
                new_stats
              )

              new_team = new_team.set('stats', merged_stats)
              state.setIn([year, t.uid], new_team)
            }
          } else {
            state.setIn([year, t.uid], createTeam(t))
          }
        })
      })

    case app_actions.LOGOUT:
      return initialState

    case auction_actions.AUCTION_PROCESSED: {
      const newCap =
        state.getIn([current_season.year, payload.tid, 'cap']) - payload.value
      return state.setIn([current_season.year, payload.tid, 'cap'], newCap)
    }

    case team_actions.PUT_TEAM_FULFILLED:
      return state.setIn(
        [current_season.year, payload.opts.teamId, payload.opts.field],
        payload.data.value
      )

    case draft_actions.DRAFTED_PLAYER:
    case draft_actions.POST_DRAFT_FULFILLED: {
      const { data } = payload
      const teamPicks = state.getIn([current_season.year, data.tid, 'picks'])
      const key = teamPicks.findKey((p) => p.uid === data.uid)
      return state.setIn(
        [current_season.year, data.tid, 'picks', key, 'pid'],
        data.pid
      )
    }

    case trade_actions.POST_TRADE_ACCEPT_FULFILLED:
      if (
        !payload.data.acceptingTeamPicks.length &&
        !payload.data.proposingTeamPicks.length
      ) {
        return state
      }

      return state.withMutations((state) => {
        // make changes to proposing team picks
        if (state.getIn([current_season.year, payload.data.propose_tid])) {
          const proposingTeam = state.getIn([
            current_season.year,
            payload.data.propose_tid
          ])
          let proposingTeamPicks = proposingTeam.get('picks')
          // remove traded picks
          if (payload.data.proposingTeamPicks.length) {
            const pickids = payload.data.proposingTeamPicks.map((p) => p.uid)
            proposingTeamPicks = proposingTeamPicks.filter(
              (p) => !pickids.includes(p.uid)
            )
          }

          // add received picks
          if (payload.data.acceptingTeamPicks.length) {
            proposingTeamPicks = proposingTeamPicks.push(
              payload.data.acceptingTeamPicks
            )
          }

          state.setIn(
            [current_season.year, payload.data.propose_tid, 'picks'],
            proposingTeamPicks
          )
        }

        if (state.getIn([current_season.year, payload.data.accept_tid])) {
          const acceptingTeam = state.getIn([
            current_season.year,
            payload.data.accept_tid
          ])
          let acceptingTeamPicks = acceptingTeam.get('picks')
          // remove traded picks
          if (payload.data.acceptingTeamPicks.length) {
            const pickids = payload.data.acceptingTeamPicks.map((p) => p.uid)
            acceptingTeamPicks = acceptingTeamPicks.filter(
              (p) => !pickids.includes(p.uid)
            )
          }

          // add received picks
          if (payload.data.proposingTeamPicks.length) {
            acceptingTeamPicks = acceptingTeamPicks.push(
              payload.data.proposingTeamPicks
            )
          }

          state.setIn(
            [current_season.year, payload.data.accept_tid, 'picks'],
            acceptingTeamPicks
          )
        }
      })

    case team_actions.POST_TEAMS_FULFILLED:
      return state.setIn(
        [current_season.year, payload.data.team.uid],
        createTeam(payload.data.team)
      )

    case team_actions.DELETE_TEAMS_FULFILLED:
      return state.deleteIn([current_season.year, payload.opts.teamId])

    case team_actions.GET_LEAGUE_TEAM_STATS_FULFILLED:
      return state.withMutations((state) => {
        payload.data.forEach((stats) => {
          if (state.hasIn([payload.opts.year, stats.tid, 'uid'])) {
            const team = state.getIn([payload.opts.year, stats.tid])
            state.setIn(
              [payload.opts.year, stats.tid],
              team.set('stats', new Map(stats))
            )
          } else {
            state.setIn(
              [payload.opts.year, stats.tid],
              createTeam({ ...stats, uid: stats.tid, stats })
            )
          }
        })
      })

    default:
      return state
  }
}
