import { Map } from 'immutable'

import { appActions } from '@core/app'
import { createTeam } from './team'
import { teamActions } from './actions'
import { auctionActions } from '@core/auction'
import { draftActions } from '@core/draft'
import { tradeActions } from '@core/trade'
import { standingsActions } from '@core/standings'

const initialState = new Map()

export function teamsReducer(state = initialState, { payload, type }) {
  switch (type) {
    case appActions.AUTH_FULFILLED:
      return state.withMutations((state) => {
        payload.data.teams.forEach((t) => state.set(t.uid, createTeam(t)))
      })

    case appActions.LOGOUT:
      return initialState

    case teamActions.GET_TEAMS_FULFILLED:
      return state.withMutations((state) => {
        payload.data.teams.forEach((t) => state.set(t.uid, createTeam(t)))
      })

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
      return state.setIn([data.tid, 'picks', key, 'player'], data.player)
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
        if (state.get(payload.data.pid)) {
          const proposingTeam = state.get(payload.data.pid)
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

          state.setIn([payload.data.pid, 'picks'], proposingTeamPicks)
        }

        if (state.get(payload.data.tid)) {
          const acceptingTeam = state.get(payload.data.tid)
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

          state.setIn([payload.data.tid, 'picks'], acceptingTeamPicks)
        }
      })

    case teamActions.POST_TEAMS_FULFILLED:
      return state.set(payload.data.team.uid, createTeam(payload.data.team))

    case teamActions.DELETE_TEAMS_FULFILLED:
      return state.delete(payload.opts.teamId)

    case standingsActions.SET_STANDINGS:
      return state.withMutations((state) => {
        for (const teamId in payload.teams) {
          const t = payload.teams[teamId]
          state.updateIn([t.tid], (team) =>
            team.merge({
              stats: new Map(t.stats)
            })
          )
        }
      })

    default:
      return state
  }
}
