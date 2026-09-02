/* global describe it */
import * as chai from 'chai'

import { app_reducer } from '@core/app/reducer'
import { app_actions } from '@core/app/actions'
import { team_actions } from '@core/teams/actions'

const expect = chai.expect

// Which team the viewer owns IN THE LEAGUE ON SCREEN.
//
// Two defects live here, and both look like an empty state rather than an
// error. AUTH_FULFILLED used to pair `leagues[0]` with `teams[0]` positionally,
// but GET /me builds those two lists from independent queries, so they are not
// the same league: for a manager in leagues 1 and 119 production returned
// league 119 first and team 1 — of league 1 — first. That pairing either
// adopted a team from a DIFFERENT league than the route, which made every
// team-scoped request 400 with `invalid leagueId` (seen on
// /teams/1/transactions/reserve?leagueId=119), or adopted no team at all, which
// made team-scoped surfaces render as if the manager owned nothing. The auction
// page is where the second half bit first: its elections fetch is gated on
// teamId, so the request was never issued and the standing-elections panel
// rendered its empty state — exactly the failure the auction design keeps
// naming, a control that renders nothing being indistinguishable in the data
// from a manager who chose not to act.
//
// The league order below is the variable the old code was sensitive to, so the
// suite runs against both. GET /me now orders its leagues, but the reducer is
// client code and must not depend on that.
describe('app teamId resolution', function () {
  const team_in_league_1 = { team_id: 1, lid: 1 }
  const team_in_league_119 = { team_id: 315, lid: 119 }

  const league_orders = {
    'leagues ascending': [{ league_id: 1 }, { league_id: 119 }],
    'leagues in the order production returned them': [
      { league_id: 119 },
      { league_id: 1 }
    ]
  }

  for (const [order_name, leagues] of Object.entries(league_orders)) {
    describe(order_name, function () {
      const auth_payload = {
        user: { id: 1 },
        leagues,
        // The teams query is ordered by team_id, which is NOT the league order.
        teams: [team_in_league_1, team_in_league_119]
      }

      const authenticate = (state) =>
        app_reducer(state, {
          type: app_actions.AUTH_FULFILLED,
          payload: { data: auth_payload }
        })

      const load_league_teams = (state, teams) =>
        app_reducer(state, {
          type: team_actions.GET_TEAMS_FULFILLED,
          payload: { data: { teams } }
        })

      const authenticate_on_league = (leagueId) =>
        authenticate(
          app_reducer(undefined, {
            type: app_actions.SELECT_LEAGUE,
            payload: { leagueId }
          })
        )

      it('adopts the team the user owns in the league the route names', function () {
        // The route is league 119 before auth resolves, which is what a full
        // page load of /leagues/119/... does.
        const state = authenticate_on_league(119)

        expect(state.get('leagueId')).to.equal(119)
        expect(state.get('teamId')).to.equal(315)
      })

      it('adopts the team of the route league when it is the user first league', function () {
        const state = authenticate_on_league(1)

        expect(state.get('leagueId')).to.equal(1)
        expect(state.get('teamId')).to.equal(1)
      })

      it('never pairs the route league with another league team', function () {
        // The 400 this file exists for: leagueId 119 with teamId 1 is the pair
        // verify-user-team rejects as `invalid leagueId`.
        const state = authenticate_on_league(119)

        expect([state.get('leagueId'), state.get('teamId')]).to.not.eql([
          119, 1
        ])
      })

      it('leaves the team unresolved on a league the user has no team in', function () {
        const state = authenticate_on_league(900)

        expect(state.get('teamId')).to.equal(undefined)
      })

      it('resolves the team from the leagues payload when the entry URL names none', function () {
        // No league in the URL, so leagues[0] decides — and the team must come
        // from THAT league, whichever one the payload happened to put first.
        const state = authenticate(app_reducer(undefined, { type: '@@INIT' }))
        const expected_league_id = leagues[0].league_id
        const expected_team_id =
          expected_league_id === 1 ? 1 : team_in_league_119.team_id

        expect(state.get('leagueId')).to.equal(expected_league_id)
        expect(state.get('teamId')).to.equal(expected_team_id)
      })

      it('keeps a teamId that is already a team of the league in view', function () {
        let state = authenticate_on_league(119)
        state = load_league_teams(state, [{ team_id: 315 }, { team_id: 316 }])

        expect(state.get('teamId')).to.equal(315)
      })

      it('clears the teamId in a league where the user owns no team', function () {
        let state = authenticate_on_league(119)
        state = load_league_teams(state, [{ team_id: 900 }, { team_id: 901 }])

        // Null rather than a team from a DIFFERENT league: rendering another
        // league's roster here would be worse than rendering none.
        expect(state.get('teamId')).to.equal(null)
      })
    })
  }
})
