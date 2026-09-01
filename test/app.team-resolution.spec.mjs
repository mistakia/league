/* global describe it */
import * as chai from 'chai'

import { app_reducer } from '@core/app/reducer'
import { app_actions } from '@core/app/actions'
import { team_actions } from '@core/teams/actions'

const expect = chai.expect

// Which team the viewer owns IN THE LEAGUE ON SCREEN.
//
// AUTH_FULFILLED can only adopt a teamId when the route's league happens to be
// the user's first one, so before this a manager in more than one league had NO
// team in any other league, and every team-scoped surface rendered as if they
// owned nothing rather than failing. Found by walking the auction page against a
// second league: the elections fetch is gated on teamId, so it was never issued
// and the standing-elections panel rendered its empty state -- which is exactly
// the failure the auction design keeps naming, a control that renders nothing
// being indistinguishable in the data from a manager who chose not to act.
//
// GET_TEAMS_FULFILLED is the payload that can answer it: it carries the teams of
// the league in view, and `teamIds` carries the ones the user owns.
describe('app teamId resolution', function () {
  const auth_payload = {
    user: { id: 1 },
    leagues: [{ league_id: 1 }, { league_id: 119 }],
    teams: [
      { team_id: 1, lid: 1 },
      { team_id: 315, lid: 119 }
    ]
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

  it('adopts the team the user owns in a league that is not their first', function () {
    // The route is league 119 before auth resolves, which is what a full page
    // load of /leagues/119/... does.
    let state = app_reducer(undefined, {
      type: app_actions.SELECT_LEAGUE,
      payload: { leagueId: 119 }
    })
    state = authenticate(state)

    // The precondition this test exists for: auth alone cannot resolve it.
    expect(state.get('teamId')).to.equal(undefined)

    state = load_league_teams(state, [{ team_id: 315 }, { team_id: 316 }])

    expect(state.get('teamId')).to.equal(315)
  })

  it('keeps a teamId that is already a team of the league in view', function () {
    let state = authenticate(app_reducer(undefined, { type: '@@INIT' }))
    expect(state.get('teamId')).to.equal(1)

    state = load_league_teams(state, [{ team_id: 1 }, { team_id: 2 }])

    expect(state.get('teamId')).to.equal(1)
  })

  it('clears the teamId in a league where the user owns no team', function () {
    let state = authenticate(app_reducer(undefined, { type: '@@INIT' }))
    state = load_league_teams(state, [{ team_id: 900 }, { team_id: 901 }])

    // Null rather than a team from a DIFFERENT league: rendering another
    // league's roster here would be worse than rendering none.
    expect(state.get('teamId')).to.equal(null)
  })
})
