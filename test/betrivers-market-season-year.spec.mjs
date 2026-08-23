/* global describe it */
import * as chai from 'chai'

import { current_season } from '#constants'
import { format_market } from '#scripts/import-betrivers-odds.mjs'

const expect = chai.expect

// BetRivers is dormant -- its last prop_markets_index row is 2024-07-17, it
// appears in no crontab on either host and has no scheduled-command entity, so
// nothing exercises this writer on a schedule and a regression here would be
// found only by whoever resumes it. The season_year omission this pins was
// repaired in DATA on 2026-08-23 and left in code until then, which is exactly
// the shape a dormant importer hides: 82,671 rows carrying an esbid and no
// season, invisible to every consumer that filters on the column.
//
// The two cases are a discriminating PAIR. Under the pre-fix writer both
// returned undefined, so either one alone could not tell the fix from its
// absence; they have to disagree with each other for the assertion to mean
// anything.
const build_betrivers_market = () => ({
  id: 'market-1',
  betDescription: 'Total Points',
  betOfferType: 'Over/Under',
  status: 'OPEN',
  // No participant, so format_market makes no find_player_row call and the
  // spec needs no player fixture.
  participant: null,
  outcomes: [
    { id: 'o-1', label: 'Over', line: '44.5', odds: 1.91, oddsAmerican: -110 },
    { id: 'o-2', label: 'Under', line: '44.5', odds: 1.91, oddsAmerican: -110 }
  ]
})

const event = { id: 'event-1', name: 'Chiefs v Ravens' }

describe('betrivers prop market season_year', function () {
  it('takes the season from the resolved game, not the current season', async () => {
    const past_season = current_season.year - 3

    const market = await format_market({
      betrivers_market: build_betrivers_market(),
      observed_at: new Date(),
      event,
      nfl_game: {
        esbid: '2023091000',
        year: past_season,
        away_nfl_team: 'KC',
        home_nfl_team: 'BAL'
      }
    })

    expect(market.esbid).to.equal('2023091000')
    expect(market.season_year).to.equal(past_season)
    expect(market.season_year).to.not.equal(current_season.year)
  })

  it('falls back to the current season when no game resolves', async () => {
    const market = await format_market({
      betrivers_market: build_betrivers_market(),
      observed_at: new Date(),
      event,
      nfl_game: null
    })

    expect(market.esbid).to.equal(null)
    expect(market.season_year).to.equal(current_season.year)
  })
})
