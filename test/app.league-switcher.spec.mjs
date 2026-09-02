/* global describe it */
import * as chai from 'chai'
import { Map, List } from 'immutable'

import { build_league_switcher_options } from '@core/leagues/league-switcher-options.mjs'
import { createLeague } from '@core/leagues/league'

const expect = chai.expect

// What the sidebar's league switcher is allowed to offer.
//
// The switcher is the only consumer, and it navigates: picking an option puts
// the browser on /leagues/<id>, which app.js turns into SELECT_LEAGUE. So an id
// this selector emits is one the user can be sent to, and the cases below are
// the ones where emitting the wrong set sends them somewhere they cannot use.
describe('league switcher options', function () {
  // Built from the real League record, not a plain Map: the record is what the
  // store holds, and it DROPS any key its declaration does not list -- so a
  // hand-rolled stand-in would keep a field the running app discards.
  const build_options = ({ leagueIds, leagues }) =>
    build_league_switcher_options({
      leagueIds: List(leagueIds),
      leagues: Map(
        leagues.map((league) => [
          league.league_id,
          createLeague({ isLoaded: true, ...league })
        ])
      )
    })

  it('names every league the user manages', function () {
    const options = build_options({
      leagueIds: [1, 119],
      leagues: [
        { league_id: 1, name: 'GENESIS LEAGUE' },
        { league_id: 119, name: 'GENESIS LEAGUE (auction mirror)' }
      ]
    })

    expect(options).to.deep.equal([
      { league_id: 1, name: 'GENESIS LEAGUE' },
      { league_id: 119, name: 'GENESIS LEAGUE (auction mirror)' }
    ])
  })

  it('keeps a league whose record has not arrived, labelled by its id', function () {
    // `leagueIds` and the league records ride the same /api/me payload, so this
    // is not the normal state -- but a switcher that silently shows fewer
    // leagues than the user has is worse than one showing a bare id, because
    // the missing league is unreachable and nothing says why.
    const options = build_options({
      leagueIds: [1, 119],
      leagues: [{ league_id: 1, name: 'GENESIS LEAGUE' }]
    })

    expect(options.map((entry) => entry.league_id)).to.deep.equal([1, 119])
    expect(options[1].name).to.equal('League 119')
  })

  it('orders by league id rather than by arrival', function () {
    // The membership list comes off the /api/me query in whatever order the
    // join produced, so an unsorted switcher reorders itself between sessions
    // and the option under the cursor is not stable.
    const options = build_options({
      leagueIds: [119, 1],
      leagues: [
        { league_id: 119, name: 'GENESIS LEAGUE (auction mirror)' },
        { league_id: 1, name: 'GENESIS LEAGUE' }
      ]
    })

    expect(options.map((entry) => entry.league_id)).to.deep.equal([1, 119])
  })

  it('offers nothing to switch to for a single-league manager', function () {
    // The menu renders the plain title below two entries, so this is the case
    // that keeps the control off screen for everyone who has one league --
    // which is every manager but the operator today.
    const options = build_options({
      leagueIds: [1],
      leagues: [{ league_id: 1, name: 'GENESIS LEAGUE' }]
    })

    expect(options).to.have.length(1)
  })
})
