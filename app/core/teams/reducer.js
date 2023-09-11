import { Map } from 'immutable'

import { appActions } from '@core/app'
import { createTeam } from './team'
import { teamActions } from './actions'
import { auctionActions } from '@core/auction'
import { draftActions } from '@core/draft'
import { tradeActions } from '@core/trade'

const initialState = new Map()

export function teamsReducer(state = initialState, { payload, type }) {
  switch (type) {
    case appActions.AUTH_FULFILLED:
    case teamActions.GET_TEAMS_FULFILLED:
      return state.withMutations((state) => {
        payload.data.teams.forEach((t) => {
          if (state.has(t.uid)) {
            state.set(t.uid, state.get(t.uid).merge(createTeam(t)))
          } else {
            state.set(t.uid, createTeam(t))
          }
        })
      })

    case appActions.LOGOUT:
      return initialState

    case auctionActions.AUCTION_PROCESSED: {
      const newCap = state.get(payload.tid).get('cap') - payload.value
      return state.setIn([payload.tid, 'cap'], newCap)
    }

    case teamActions.PUT_TEAM_FULFILLED:
      return state.setIn(
        [payload.opts.teamId, payload.opts.field],
        payload.data.value
      )

    case draftActions.DRAFTED_PLAYER:
    case draftActions.POST_DRAFT_FULFILLED: {
      const { data } = payload
      const teamPicks = state.getIn([data.tid, 'picks'])
      const key = teamPicks.findKey((p) => p.uid === data.uid)
      return state.setIn([data.tid, 'picks', key, 'pid'], data.pid)
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
        if (state.get(payload.data.propose_tid)) {
          const proposingTeam = state.get(payload.data.propose_tid)
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

          state.setIn([payload.data.propose_tid, 'picks'], proposingTeamPicks)
        }

        if (state.get(payload.data.accept_tid)) {
          const acceptingTeam = state.get(payload.data.accept_tid)
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

          state.setIn([payload.data.accept_tid, 'picks'], acceptingTeamPicks)
        }
      })

    case teamActions.POST_TEAMS_FULFILLED:
      return state.set(payload.data.team.uid, createTeam(payload.data.team))

    case teamActions.DELETE_TEAMS_FULFILLED:
      return state.delete(payload.opts.teamId)

    case teamActions.GET_LEAGUE_TEAM_STATS_FULFILLED:
      return state.withMutations((state) => {
        payload.data.forEach((stats) => {
          if (state.hasIn([stats.tid, 'uid'])) {
            const team = state.get(stats.tid)
            state.set(
              stats.tid,
              team.setIn(['stats', stats.year], new Map(stats))
            )
          } else {
            state.set(
              stats.tid,
              createTeam({ ...stats, uid: stats.tid, stats })
            )
          }
        })
      })

    default:
      return state
  }
}
