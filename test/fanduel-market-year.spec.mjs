/* global describe it */
import * as chai from 'chai'

import { get_market_year } from '#libs-server/fanduel/fanduel-market-types.mjs'

const expect = chai.expect

// Every name here is a real source_market_name FanDuel wrote, read off
// prop_markets_index on 2026-08-23. The THRESHOLD_LEADING group is the one that
// matters: the pre-fix reader took the first four-digit run in the string, so
// each of those returned its yardage or odds threshold as a season and 86 rows
// landed carrying it. Kept as literals rather than generated, because the defect
// lives in the exact punctuation.
const SPAN_NAMES = [
  ['1000+ Regular Season Receiving Yards 2024-25', 2024],
  ['1000+ Regular Season Rushing Yards 2025-26', 2025],
  ['1250+ Regular Season Receiving Yards 2024-25', 2024],
  ['1500+ Regular Season Receiving Yards 2025-26', 2025],
  ['2000+ Regular Season Rushing Yards 2025-26', 2025],
  ['4000+ Regular Season Passing Yards 2025-26', 2025],
  ['4500+ Regular Season Passing Yards 2025-26', 2025],
  // Two-digit thresholds were already read correctly, so these are the control
  // that the fix did not move a name that was never broken.
  ['10+ Regular Season Receiving TDs 2024-25', 2024],
  ['12+ Regular Season Rushing TDs 2025-26', 2025],
  ['15+ Regular Season Rushing TDs 2025-26', 2025],
  ['10+ Regular Season Wins 2025-26', 2025]
]

// No season anywhere in the name. The only four-digit runs are odds, so the
// honest answer is null and the pre-fix reader answered 1900, 2000 and 5000.
const ODDS_ONLY_NAMES = [
  'Championship Sunday Specials: +500 To +1900',
  'Championship Sunday Specials: +5000 or Above',
  'Thanksgiving Day Specials: +2000 to +4900'
]

describe('fanduel get_market_year', function () {
  it('reads the season span rather than the leading threshold', () => {
    for (const [marketName, expected] of SPAN_NAMES) {
      expect(
        get_market_year({ marketName, source_event_name: null }),
        marketName
      ).to.equal(expected)
    }
  })

  it('returns null when every four-digit run is an odds threshold', () => {
    for (const marketName of ODDS_ONLY_NAMES) {
      expect(
        get_market_year({ marketName, source_event_name: null }),
        marketName
      ).to.equal(null)
    }
  })

  it('reads a bare four-digit season that is not a threshold', () => {
    expect(
      get_market_year({
        marketName: 'Super Bowl 2026 Winner',
        source_event_name: null
      })
    ).to.equal(2026)
  })

  it('does not read a four-digit run out of a longer number', () => {
    expect(
      get_market_year({
        marketName: 'Team to score 12345 points',
        source_event_name: null
      })
    ).to.equal(null)
  })

  // The event-scoped branch is unchanged and still unimplemented. Asserted so a
  // later change to it is a deliberate one: today every market carrying an event
  // name gets its season from the resolved game instead, and this returning
  // anything but null would start competing with that.
  it('defers to the game for an event-scoped market', () => {
    expect(
      get_market_year({
        marketName: '2023-24 Total Regular Season Passing Yards Match Bet',
        source_event_name: 'Buffalo Bills @ Kansas City Chiefs'
      })
    ).to.equal(null)
  })
})
