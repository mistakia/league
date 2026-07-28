/* global describe it */

import * as chai from 'chai'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

import { getDraftWindow } from '#libs-shared'

dayjs.extend(utc)
dayjs.extend(timezone)
chai.should()
const expect = chai.expect

const TIMEZONE = 'America/New_York'

// Fixed dates rather than "today" — the hour bounds and the overnight rollover
// make these assertions sensitive to both DST and the wall-clock time the
// suite happens to run at.
const et = (str) => dayjs.tz(str, TIMEZONE)

// Sat Aug 22 2026 00:00 ET — the real 2026 rookie draft start.
const draft_start = et('2026-08-22 00:00')

const format = (window) => window.format('YYYY-MM-DD HH:mm')

describe('LIBS-SHARED getDraftWindow', function () {
  describe('hourly cadence, pre-draft', function () {
    // Defaults are min = 11, max = 16. max is exclusive, so the valid start
    // hours are 11, 12, 13, 14, 15 — five slots per day.
    const start = et('2026-08-22 00:00').unix()

    it('first pick rolls forward from midnight to the first valid hour', () => {
      const window = getDraftWindow({ start, pickNum: 1 })
      expect(format(window)).to.equal('2026-08-22 11:00')
    })

    it('second pick advances one hour', () => {
      const window = getDraftWindow({ start, pickNum: 2 })
      expect(format(window)).to.equal('2026-08-22 12:00')
    })

    it('fifth pick lands on the last valid hour of the day', () => {
      const window = getDraftWindow({ start, pickNum: 5 })
      expect(format(window)).to.equal('2026-08-22 15:00')
    })

    it('sixth pick crosses the day boundary to the first valid hour', () => {
      // max is exclusive: 16:00 is NOT a valid start hour, so pick 6 is the
      // first to roll over rather than pick 7.
      const window = getDraftWindow({ start, pickNum: 6 })
      expect(format(window)).to.equal('2026-08-23 11:00')
    })

    it('seventh pick continues on the following day', () => {
      const window = getDraftWindow({ start, pickNum: 7 })
      expect(format(window)).to.equal('2026-08-23 12:00')
    })
  })

  describe('hour bound semantics', function () {
    const start = et('2026-08-22 00:00').unix()

    it('min is inclusive', () => {
      const window = getDraftWindow({ start, pickNum: 1, min: 9, max: 22 })
      expect(window.hour()).to.equal(9)
    })

    it('max is exclusive', () => {
      // [9, 22) is thirteen slots: 09:00 through 21:00. Pick 13 is the last of
      // the day and pick 14 rolls over.
      expect(
        format(getDraftWindow({ start, pickNum: 13, min: 9, max: 22 }))
      ).to.equal('2026-08-22 21:00')
      expect(
        format(getDraftWindow({ start, pickNum: 14, min: 9, max: 22 }))
      ).to.equal('2026-08-23 09:00')
    })

    it('min = 0, max = 24 treats every hour as valid', () => {
      const window = getDraftWindow({ start, pickNum: 1, min: 0, max: 24 })
      expect(format(window)).to.equal('2026-08-22 00:00')
    })

    it('falls back to [0, 24) when the interval is empty or inverted', () => {
      expect(
        format(getDraftWindow({ start, pickNum: 1, min: 16, max: 16 }))
      ).to.equal('2026-08-22 00:00')
      expect(
        format(getDraftWindow({ start, pickNum: 1, min: 20, max: 8 }))
      ).to.equal('2026-08-22 00:00')
    })
  })

  describe('daily cadence', function () {
    const start = et('2026-08-22 00:00').unix()

    it('advances one calendar day per pick, preserving the hour', () => {
      expect(
        format(
          getDraftWindow({ start, pickNum: 1, type: 'day', min: 0, max: 24 })
        )
      ).to.equal('2026-08-22 00:00')
      expect(
        format(
          getDraftWindow({ start, pickNum: 2, type: 'day', min: 0, max: 24 })
        )
      ).to.equal('2026-08-23 00:00')
      expect(
        format(
          getDraftWindow({ start, pickNum: 58, type: 'day', min: 0, max: 24 })
        )
      ).to.equal('2026-10-18 00:00')
    })

    it('terminates when the start hour is outside the bounds', function () {
      // Regression: ensureValidHours used to advance by whole days looking for
      // a valid HOUR, which never changes the hour of day — this call spun
      // forever and, running inside the draft POST handler, blocked the API
      // event loop. There is no way to make this fail fast: a synchronous
      // infinite loop starves mocha's own timer, so on the old code this hangs
      // the entire suite rather than reporting a failure.
      this.timeout(5000)
      const window = getDraftWindow({
        start,
        pickNum: 2,
        type: 'day',
        min: 11,
        max: 16
      })
      expect(format(window)).to.equal('2026-08-23 11:00')
    })
  })

  describe('mid-draft, measured from the last consecutive pick', function () {
    const start = draft_start.unix()
    const last_consecutive_pick = {
      pick: 29,
      selection_timestamp: et('2026-08-25 14:37').unix()
    }
    const hourly = {
      start,
      type: 'hour',
      min: 9,
      max: 22,
      last_consecutive_pick
    }

    it('pick_diff of 1 is open immediately', () => {
      // The team on the clock is on it the instant the pick before them lands.
      // The selection's own minutes are preserved rather than rounded away.
      expect(format(getDraftWindow({ ...hourly, pickNum: 30 }))).to.equal(
        '2026-08-25 14:37'
      )
    })

    it('pick_diff of 2 opens one step later', () => {
      expect(format(getDraftWindow({ ...hourly, pickNum: 31 }))).to.equal(
        '2026-08-25 15:37'
      )
    })

    it('pick_diff greater than 2 opens one step per intervening pick', () => {
      expect(format(getDraftWindow({ ...hourly, pickNum: 34 }))).to.equal(
        '2026-08-25 18:37'
      )
    })

    it('does not regress to the absolute pick number', () => {
      // Regression: the hourly path ignored last_consecutive_pick.pick and
      // advanced by pickNum - 1 hours from midnight of the last pick's day, so
      // making a pick pushed the next team's window HOURS INTO THE FUTURE
      // instead of opening it. Deep in the draft the error was ~2 days.
      const window = getDraftWindow({ ...hourly, pickNum: 30 })
      expect(window.unix()).to.equal(last_consecutive_pick.selection_timestamp)
    })

    it('skips the overnight gap', () => {
      const late = {
        pick: 29,
        selection_timestamp: et('2026-08-25 21:30').unix()
      }
      const args = {
        start,
        type: 'hour',
        min: 9,
        max: 22,
        last_consecutive_pick: late
      }
      expect(format(getDraftWindow({ ...args, pickNum: 30 }))).to.equal(
        '2026-08-25 21:30'
      )
      expect(format(getDraftWindow({ ...args, pickNum: 31 }))).to.equal(
        '2026-08-26 09:00'
      )
    })

    it('daily cadence holds the time of day across the step', () => {
      expect(
        format(
          getDraftWindow({
            start,
            type: 'day',
            min: 0,
            max: 24,
            last_consecutive_pick,
            pickNum: 31
          })
        )
      ).to.equal('2026-08-26 14:37')
    })

    it('falls back to the pre-draft calculation when pick_diff is not positive', () => {
      // Asking for a pick that is already made means the caller's view of the
      // draft is inconsistent; we measure from the draft start instead of
      // producing a window behind the reference.
      const window = getDraftWindow({ ...hourly, pickNum: 29 })
      const pre_draft = getDraftWindow({
        start,
        type: 'hour',
        min: 9,
        max: 22,
        pickNum: 29
      })
      expect(format(window)).to.equal(format(pre_draft))
    })
  })

  describe('2026 rookie draft projection', function () {
    const start = draft_start.unix()

    it('completes all 58 picks before free agency opens Sep 2', () => {
      // Worst case: nobody picks and every window opens on the cadence alone.
      // [9, 22) is thirteen slots a day, so 58 picks span five calendar days.
      const settings = { start, type: 'hour', min: 9, max: 22 }

      expect(format(getDraftWindow({ ...settings, pickNum: 1 }))).to.equal(
        '2026-08-22 09:00'
      )
      expect(format(getDraftWindow({ ...settings, pickNum: 58 }))).to.equal(
        '2026-08-26 14:00'
      )

      const free_agency_opens = et('2026-09-02 00:00')
      const final_window = getDraftWindow({ ...settings, pickNum: 58 })
      expect(final_window.isBefore(free_agency_opens)).to.equal(true)
    })

    it('every window is strictly ordered and inside the hour bounds', () => {
      const settings = { start, type: 'hour', min: 9, max: 22 }
      let previous = null

      for (let pick = 1; pick <= 58; pick++) {
        const window = getDraftWindow({ ...settings, pickNum: pick })
        expect(window.hour()).to.be.at.least(9)
        expect(window.hour()).to.be.below(22)
        if (previous) {
          expect(window.isAfter(previous)).to.equal(true)
        }
        previous = window
      }
    })
  })
})
