import { Map } from 'immutable'

import { appActions } from '@core/app'
import { createTeam } from './team'
import { teamActions } from './actions'
import { auctionActions } from '@core/auction'
import { draftActions } from '@core/draft'
import { tradeActions } from '@core/trade'
import { constants } from '@libs-shared'

const initialState = new Map()

export function teamsReducer(state = initialState, { payload, type }) {
  switch (type) {
    case appActions.AUTH_FULFILLED:
    case teamActions.GET_TEAMS_FULFILLED:
      return state.withMutations((state) => {
        const year = payload.opts.year || constants.year
        payload.data.teams.forEach((t) => {
          if (state.hasIn([year, t.uid])) {
            if (t.stats) {
              state.setIn(
                [year, t.uid],
                state.getIn([year, t.uid]).mergeDeep(createTeam(t))
              )
            } else {
              const new_team = state.getIn([year, t.uid]).merge(createTeam(t))
              // TODO dont think this is needed anymore
              // const existing_stats = state.getIn([year, t.uid]).get('stats')
              // for (const [year, stats] of existing_stats.entrySeq()) {
              //   new_team = new_team.setIn(['stats', Number(year)], stats)
              // }

              state.setIn([year, t.uid], new_team)
            }
          } else {
            state.setIn([year, t.uid], createTeam(t))
          }
        })
      })

    case appActions.LOGOUT:
      return initialState

    case auctionActions.AUCTION_PROCESSED: {
      const newCap =
        state.getIn([constants.year, payload.tid, 'cap']) - payload.value
      return state.setIn([constants.year, payload.tid, 'cap'], newCap)
    }

    case teamActions.PUT_TEAM_FULFILLED:
      return state.setIn(
        [constants.year, payload.opts.teamId, payload.opts.field],
        payload.data.value
      )

    case draftActions.DRAFTED_PLAYER:
    case draftActions.POST_DRAFT_FULFILLED: {
      const { data } = payload
      const teamPicks = state.getIn([constants.year, data.tid, 'picks'])
      const key = teamPicks.findKey((p) => p.uid === data.uid)
      return state.setIn(
        [constants.year, data.tid, 'picks', key, 'pid'],
        data.pid
      )
    }

    case tradeActions.POST_TRADE_ACCEPT_FULFILLED:
      if (
        !payload.data.acceptingTeamPicks.length &&
        !payload.data.proposingTeamPicks.length
      ) {
        return state
      }

      return state.withMutations((state) => {
        // make changes to proposing team picks
        if (state.getIn([constants.year, payload.data.propose_tid])) {
          const proposingTeam = state.getIn([
            constants.year,
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
            [constants.year, payload.data.propose_tid, 'picks'],
            proposingTeamPicks
          )
        }

        if (state.getIn([constants.year, payload.data.accept_tid])) {
          const acceptingTeam = state.getIn([
            constants.year,
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
            [constants.year, payload.data.accept_tid, 'picks'],
            acceptingTeamPicks
          )
        }
      })

    case teamActions.POST_TEAMS_FULFILLED:
      return state.setIn(
        [constants.year, payload.data.team.uid],
        createTeam(payload.data.team)
      )

    case teamActions.DELETE_TEAMS_FULFILLED:
      return state.deleteIn([constants.year, payload.opts.teamId])

    case teamActions.GET_LEAGUE_TEAM_STATS_FULFILLED:
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
