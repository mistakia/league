/* global describe it */
import * as chai from 'chai'

import { get_market_year } from '#libs-server/fanduel/fanduel-market-types.mjs'

const expect = chai.expect

// Every name here is a real source_market_name FanDuel wrote, read off
// prop_markets_index on 2026-08-23. The threshold-leading group is the one that
// matters: the pre-fix reader took the first four-digit run in the string, so
// each of those returned its yardage or odds threshold as a season and the rows
// that landed carrying it were repaired in
// db/adhoc/2026-08-23-repair-fanduel-threshold-season-years.sql. Kept as
// literals rather than generated, because the defect lives in the exact
// punctuation.
const SPAN_NAMES = [
  ['1000+ Regular Season Receiving Yards 2024-25', 2024],
  ['1000+ Regular Season Rushing Yards 2025-26', 2025],
  ['1250+ Regular Season Receiving Yards 2024-25', 2024],
  ['1500+ Regular Season Receiving Yards 2025-26', 2025],
  ['2000+ Regular Season Rushing Yards 2025-26', 2025],
  ['4000+ Regular Season Passing Yards 2025-26', 2025],
  ['4500+ Regular Season Passing Yards 2025-26', 2025],
  // The threshold does not lead the string here, so a fix anchored on position
  // rather than on shape would miss it.
  ['To Throw 4000+ Regular Season Passing Yards 2024-25', 2024],
  // Threshold and span both mid-string, with a trailing prose parenthetical
  // carrying digits of its own -- the only real name of that shape.
  [
    'Mike Evans to Record 1000+ Receiving Yards in the 2024-25 Regular Season (Currently on 818 Yards)',
    2024
  ],
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
  'Thanksgiving Day Specials: +2000 to +4900',
  // Same family without the space after the colon. Three real names carry this
  // spelling and none was covered until 2026-08-23; the defect lives in the
  // punctuation, so the punctuation variant has to be asserted too.
  'Christmas Day Specials:+5000 or Above',
  'Red Zone Specials:+5000 or Above',
  'Thanksgiving Day Specials:+5000 or Above'
]

// A threshold that carries no '+' next to the number at all. The first fix read
// a threshold as "a run with a + on one side", which left every one of these
// still returning a yardage as a season -- 5477, 2105, 1964 and 1000. Note the
// last pair carries a '+' in the string, on the RECEPTIONS count, several words
// away from the yardage that actually gets misread.
const UNMARKED_THRESHOLD_NAMES = [
  'Any Player to Break the Record for Most Passing Yards in the Regular Season (Over 5477.5 Reg season Pass Yards)',
  'Any Player to Break the Record for Most Rush Yards in the Reg Season (Over 2105.5 Reg Season Rush Yards)',
  'Any Player to Break the Record for Most Receiving Yards in the Reg Season (Over 1964.5 Reg Season Rec Yards)',
  "Ja'Marr Chase to have 75+ Receptions & 1000 Yards Receiving Yards",
  'Jaylen Waddle to have 75+ Receptions & 1000 Yards Receiving Yards'
]

// The bare-year branch, which the threshold rules must not swallow. These are
// the two families that carry a real season with no span: the draft markets and
// the playoff/all-pro markets whose second year is four digits, so
// SEASON_SPAN_PATTERN does not match and the bare reader is what answers.
const BARE_YEAR_NAMES = [
  ['2024 NFL Draft - First Running Back Drafted', 2024],
  ['LIVE - 2023 NFL Draft - Position of 14th Overall Pick', 2023],
  ['New Orleans Saints - To Make the Playoffs 2024-2025', 2024],
  ['To Be Named AP NFL First Team All-Pro Quarterback 2024-2025', 2024],
  ['Team To Score The Most Regular Season Points 2023/24', 2023],
  ['SPP - To Make the Playoffs 2024', 2024]
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

  it('returns null for a threshold carrying no adjacent plus sign', () => {
    for (const marketName of UNMARKED_THRESHOLD_NAMES) {
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

    for (const [marketName, expected] of BARE_YEAR_NAMES) {
      expect(
        get_market_year({ marketName, source_event_name: null }),
        marketName
      ).to.equal(expected)
    }
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
