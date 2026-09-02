/* global describe it */
import * as chai from 'chai'
import dayjs from 'dayjs'

import {
  format_free_agency_period_advance_message,
  format_free_agency_period_start_message
} from '#scripts/announce-free-agency-period-start.mjs'

const expect = chai.expect

// THE ANNOUNCEMENT NOBODY COULD REACH.
//
// Both builders were module-private consts in a script, so no spec could
// import them however much anyone wanted to -- the same class as the two
// auction Discord messages closed on 2026-09-02, and found while closing them.
// Exporting is the whole unblock; the script's own entry point is unchanged and
// `scripts/**/*.mjs` is already a knip entry surface, so the exports are not
// dead code.
//
// These run on a real cron. `server/crontab-main/league-maintenance.cron`
// fires this script every 30 minutes through August and September, so the
// start message goes out to every league's Discord channel on the day its free
// agency period opens, unattended. Content is the whole product: there is no
// return value a caller inspects and no UI anyone checks.
//
// PURE BUILDERS, so no fixture and no database. What is asserted is what a
// manager reads and what a mistake here would silently change.
describe('free agency period announcement', function () {
  const period_start_time = dayjs('2026-09-03T03:59:59Z')
  const league_name = 'TEST League'

  const advance = (overrides = {}) =>
    format_free_agency_period_advance_message({
      league_name,
      period_start_time,
      ...overrides
    })

  const start = (overrides = {}) =>
    format_free_agency_period_start_message({
      league_name,
      period_start_time,
      ...overrides
    })

  // THE REALISTIC DEFECT IS A SWAP, not a typo. The two builders take identical
  // arguments, sit adjacent, and differ only in tense -- so a caller wired to
  // the wrong one, or a copy-paste that never changed the body, produces a
  // perfectly well-formed message announcing the wrong event. Nothing
  // downstream can tell: `sendNotifications` takes a string.
  describe('the two notices say different things', function () {
    it('announces the advance notice as still to come', function () {
      const message = advance()

      expect(message).to.include('will begin in 7 days')
      expect(message).to.include('will start on')
      expect(message, 'not the start notice').to.not.include('has begun')
    })

    it('announces the start notice as already happened', function () {
      const message = start()

      expect(message).to.include('has begun')
      expect(message).to.include('started on')
      expect(message, 'not the advance notice').to.not.include('in 7 days')
    })
  })

  // The poaching constraint is the only ACTIONABLE sentence in either message.
  // A manager who misses it submits a claim that cannot be accepted.
  it('names the poaching constraint in both notices', function () {
    expect(advance(), 'advance notice').to.include(
      'poaching claims cannot be submitted'
    )
    expect(start(), 'start notice').to.include(
      'poaching claims cannot be submitted'
    )
  })

  it('names the league', function () {
    expect(advance()).to.include(league_name)
    expect(start()).to.include(league_name)
  })

  // An unnamed league is a real row shape, and the fallback exists for it. Left
  // unasserted, a broken fallback ships a message reading "for undefined" or
  // "for " to a whole Discord channel.
  it('falls back to a generic name rather than printing a blank', function () {
    for (const missing of [null, undefined, '']) {
      const message = start({ league_name: missing })
      expect(message, `league_name ${String(missing)}`).to.include(
        'for this league'
      )
      expect(message).to.not.include('undefined')
      expect(message).to.not.include('null')
    }
  })

  // THE FAILURE THAT LOOKS LIKE SUCCESS. `dayjs().format()` on anything it
  // cannot parse returns the STRING "Invalid Date" rather than throwing, so a
  // bad timestamp produces a message that sends cleanly and tells the league
  // nothing. Assert the rendered date is real, and assert the shape rather than
  // a literal -- a literal would pin the runner's timezone rather than the
  // formatter.
  it('renders a real date rather than Invalid Date', function () {
    for (const message of [advance(), start()]) {
      expect(message).to.not.include('Invalid Date')
      expect(message, 'a weekday name').to.match(
        /Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/
      )
      expect(message, 'a four-digit year').to.match(/\b2026\b/)
      expect(message, 'a twelve-hour clock').to.match(/\d{1,2}:\d{2} (AM|PM)/)
    }
  })

  it('does not leak a raw timestamp into the message', function () {
    for (const message of [advance(), start()]) {
      expect(message, 'no ISO string').to.not.include('T03:59:59')
      expect(message, 'no unix seconds').to.not.include(
        String(period_start_time.unix())
      )
    }
  })
})
