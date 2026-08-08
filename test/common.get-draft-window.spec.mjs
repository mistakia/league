/* global describe it */

import * as chai from 'chai'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

import { getDraftWindow } from '#libs-shared'
import get_draft_window_config from '#libs-shared/get-draft-window-config.mjs'
import timestamptz_to_epoch from '#libs-shared/timestamptz-to-epoch.mjs'

dayjs.extend(utc)
dayjs.extend(timezone)
chai.should()
const expect = chai.expect

const DRAFT_TIMEZONE = 'America/New_York'

// Fixed dates rather than "today" — the daily window and the overnight
// rollover make these assertions sensitive to both DST and the wall-clock time
// the suite happens to run at.
const eastern = (date_string) => dayjs.tz(date_string, DRAFT_TIMEZONE)

// Sat Aug 22 2026 00:00 ET — the real 2026 rookie draft start.
const draft_start_timestamp = eastern('2026-08-22 00:00').unix()

// The settings elected for the 2026 rookie draft.
const hourly_9_to_22 = {
  draft_start_timestamp,
  cadence_unit: 'hour',
  daily_window_start_hour: 9,
  daily_window_end_hour: 22
}

const format = (window) => window.format('YYYY-MM-DD HH:mm')

describe('LIBS-SHARED getDraftWindow', function () {
  describe('hourly cadence, pre-draft', function () {
    // Defaults open windows 11:00 through 15:00 — end hour 16 is exclusive.
    it('first pick rolls forward from midnight to the first open hour', () => {
      expect(
        format(getDraftWindow({ draft_start_timestamp, pick_number: 1 }))
      ).to.equal('2026-08-22 11:00')
    })

    it('second pick advances one hour', () => {
      expect(
        format(getDraftWindow({ draft_start_timestamp, pick_number: 2 }))
      ).to.equal('2026-08-22 12:00')
    })

    it('fifth pick lands on the last open hour of the day', () => {
      expect(
        format(getDraftWindow({ draft_start_timestamp, pick_number: 5 }))
      ).to.equal('2026-08-22 15:00')
    })

    it('sixth pick crosses the day boundary to the first open hour', () => {
      // The end hour is exclusive: 16:00 is NOT an open hour, so pick 6 is the
      // first to roll over rather than pick 7.
      expect(
        format(getDraftWindow({ draft_start_timestamp, pick_number: 6 }))
      ).to.equal('2026-08-23 11:00')
    })

    it('seventh pick continues on the following day', () => {
      expect(
        format(getDraftWindow({ draft_start_timestamp, pick_number: 7 }))
      ).to.equal('2026-08-23 12:00')
    })
  })

  describe('daily window bounds', function () {
    it('the start hour is inclusive', () => {
      expect(
        getDraftWindow({ ...hourly_9_to_22, pick_number: 1 }).hour()
      ).to.equal(9)
    })

    it('the end hour is exclusive', () => {
      // [9, 22) is thirteen slots: 09:00 through 21:00. Pick 13 is the last of
      // the day and pick 14 rolls over.
      expect(
        format(getDraftWindow({ ...hourly_9_to_22, pick_number: 13 }))
      ).to.equal('2026-08-22 21:00')
      expect(
        format(getDraftWindow({ ...hourly_9_to_22, pick_number: 14 }))
      ).to.equal('2026-08-23 09:00')
    })

    it('[0, 24) treats every hour as open', () => {
      expect(
        format(
          getDraftWindow({
            draft_start_timestamp,
            pick_number: 1,
            daily_window_start_hour: 0,
            daily_window_end_hour: 24
          })
        )
      ).to.equal('2026-08-22 00:00')
    })

    it('widens an empty or inverted window to the whole day', () => {
      for (const [start_hour, end_hour] of [
        [16, 16],
        [20, 8]
      ]) {
        expect(
          format(
            getDraftWindow({
              draft_start_timestamp,
              pick_number: 1,
              daily_window_start_hour: start_hour,
              daily_window_end_hour: end_hour
            })
          )
        ).to.equal('2026-08-22 00:00')
      }
    })
  })

  describe('daily cadence', function () {
    const daily = {
      draft_start_timestamp,
      cadence_unit: 'day',
      daily_window_start_hour: 0,
      daily_window_end_hour: 24
    }

    it('advances one calendar day per pick, holding the time of day', () => {
      expect(format(getDraftWindow({ ...daily, pick_number: 1 }))).to.equal(
        '2026-08-22 00:00'
      )
      expect(format(getDraftWindow({ ...daily, pick_number: 2 }))).to.equal(
        '2026-08-23 00:00'
      )
      expect(format(getDraftWindow({ ...daily, pick_number: 58 }))).to.equal(
        '2026-10-18 00:00'
      )
    })

    it('terminates when the start hour is outside the daily window', function () {
      // Regression: ensureValidHours advanced by whole DAYS looking for a valid
      // HOUR, which never changes the hour of day, so this call spun forever.
      // Running inside the draft POST handler, it blocked the API event loop
      // rather than just the request. There is no way to make this fail fast —
      // a synchronous infinite loop starves mocha's own timer, so against the
      // old code this hangs the entire suite instead of reporting a failure.
      this.timeout(5000)
      expect(
        format(
          getDraftWindow({
            draft_start_timestamp,
            pick_number: 2,
            cadence_unit: 'day',
            daily_window_start_hour: 11,
            daily_window_end_hour: 16
          })
        )
      ).to.equal('2026-08-23 11:00')
    })
  })

  describe('cadence interval', function () {
    const every_two_hours = { ...hourly_9_to_22, cadence_interval: 2 }

    it('spaces hourly windows by the interval', () => {
      expect(
        format(getDraftWindow({ ...every_two_hours, pick_number: 1 }))
      ).to.equal('2026-08-22 09:00')
      expect(
        format(getDraftWindow({ ...every_two_hours, pick_number: 2 }))
      ).to.equal('2026-08-22 11:00')
      expect(
        format(getDraftWindow({ ...every_two_hours, pick_number: 3 }))
      ).to.equal('2026-08-22 13:00')
    })

    it('carries a partial interval across the overnight gap', () => {
      // Seven slots a day at [9, 22) with a two-hour interval: 9, 11, 13, 15,
      // 17, 19, 21. The eighth pick steps past 22:00 and resumes next morning.
      expect(
        format(getDraftWindow({ ...every_two_hours, pick_number: 7 }))
      ).to.equal('2026-08-22 21:00')
      expect(
        format(getDraftWindow({ ...every_two_hours, pick_number: 8 }))
      ).to.equal('2026-08-23 10:00')
    })

    it('spaces daily windows by the interval', () => {
      expect(
        format(
          getDraftWindow({
            draft_start_timestamp,
            pick_number: 4,
            cadence_unit: 'day',
            cadence_interval: 2,
            daily_window_start_hour: 0,
            daily_window_end_hour: 24
          })
        )
      ).to.equal('2026-08-28 00:00')
    })

    it('falls back to 1 for a non-positive or fractional interval', () => {
      for (const cadence_interval of [0, -3, 1.5]) {
        expect(
          format(
            getDraftWindow({
              ...hourly_9_to_22,
              cadence_interval,
              pick_number: 2
            })
          )
        ).to.equal('2026-08-22 10:00')
      }
    })
  })

  describe('unrecognized cadence unit', function () {
    it('falls back to hourly rather than silently accepting it', () => {
      expect(
        format(
          getDraftWindow({
            ...hourly_9_to_22,
            cadence_unit: 'HOUR',
            pick_number: 2
          })
        )
      ).to.equal('2026-08-22 10:00')
    })
  })

  describe('mid-draft, measured from the last consecutive pick', function () {
    // draft.selection_timestamp is timestamptz, so the calculator takes the
    // instant rather than epoch seconds.
    const last_consecutive_pick = {
      pick: 29,
      selection_timestamp: eastern('2026-08-25 14:37').toDate()
    }
    const mid_draft = { ...hourly_9_to_22, last_consecutive_pick }

    it('the immediate next pick is open on the instant', () => {
      // The team on the clock is on it the moment the pick before them lands.
      // The selection's own minutes are preserved rather than rounded away.
      expect(
        format(getDraftWindow({ ...mid_draft, pick_number: 30 }))
      ).to.equal('2026-08-25 14:37')
    })

    it('two picks ahead opens one step later', () => {
      expect(
        format(getDraftWindow({ ...mid_draft, pick_number: 31 }))
      ).to.equal('2026-08-25 15:37')
    })

    it('more than two picks ahead opens one step per intervening pick', () => {
      expect(
        format(getDraftWindow({ ...mid_draft, pick_number: 34 }))
      ).to.equal('2026-08-25 18:37')
    })

    it('does not regress to the absolute pick number', () => {
      // Regression: the hourly path ignored last_consecutive_pick.pick and
      // advanced by pick_number - 1 hours from midnight of the last pick's day,
      // so making a pick pushed the next team's window HOURS INTO THE FUTURE
      // instead of opening it. Deep in the draft the error approached two days.
      expect(getDraftWindow({ ...mid_draft, pick_number: 30 }).unix()).to.equal(
        timestamptz_to_epoch(last_consecutive_pick.selection_timestamp)
      )
    })

    it('refuses epoch seconds for the selection rather than reading them as 1970', () => {
      // The 2026-08-07 conformance pass retyped draft.selection_timestamp to
      // timestamptz. A caller still passing epoch seconds must fail loudly:
      // dayjs.unix() on a Date is the silent class this convention exists to
      // end, and it renders as a year-58,000 window instead of throwing.
      expect(() =>
        getDraftWindow({
          ...hourly_9_to_22,
          pick_number: 30,
          last_consecutive_pick: {
            pick: 29,
            selection_timestamp: eastern('2026-08-25 14:37').unix()
          }
        })
      ).to.throw(/expected a Date or an ISO string/)
    })

    it('skips the overnight gap', () => {
      const after_hours = {
        ...hourly_9_to_22,
        last_consecutive_pick: {
          pick: 29,
          selection_timestamp: eastern('2026-08-25 21:30').toDate()
        }
      }
      expect(
        format(getDraftWindow({ ...after_hours, pick_number: 30 }))
      ).to.equal('2026-08-25 21:30')
      expect(
        format(getDraftWindow({ ...after_hours, pick_number: 31 }))
      ).to.equal('2026-08-26 09:00')
    })

    it('daily cadence holds the time of day across the step', () => {
      expect(
        format(
          getDraftWindow({
            draft_start_timestamp,
            pick_number: 31,
            cadence_unit: 'day',
            daily_window_start_hour: 0,
            daily_window_end_hour: 24,
            last_consecutive_pick
          })
        )
      ).to.equal('2026-08-26 14:37')
    })

    it('measures from the draft start when the pick is not ahead', () => {
      // A pick at or behind the reference means the caller's view of the draft
      // is inconsistent; measuring from the reference would place the window
      // behind it.
      expect(
        format(getDraftWindow({ ...mid_draft, pick_number: 29 }))
      ).to.equal(format(getDraftWindow({ ...hourly_9_to_22, pick_number: 29 })))
    })
  })

  describe('2026 rookie draft projection', function () {
    it('opens all 58 windows before free agency opens Sep 2', () => {
      // Worst case: nobody picks and every window opens on the cadence alone.
      // [9, 22) is thirteen slots a day, so 58 picks span five calendar days.
      expect(
        format(getDraftWindow({ ...hourly_9_to_22, pick_number: 1 }))
      ).to.equal('2026-08-22 09:00')

      const final_window = getDraftWindow({
        ...hourly_9_to_22,
        pick_number: 58
      })
      expect(format(final_window)).to.equal('2026-08-26 14:00')
      expect(final_window.isBefore(eastern('2026-09-02 00:00'))).to.equal(true)
    })

    it('orders every window strictly and inside the daily window', () => {
      let previous_window = null

      for (let pick_number = 1; pick_number <= 58; pick_number++) {
        const window = getDraftWindow({ ...hourly_9_to_22, pick_number })
        expect(window.hour()).to.be.at.least(9)
        expect(window.hour()).to.be.below(22)
        if (previous_window) {
          expect(window.isAfter(previous_window)).to.equal(true)
        }
        previous_window = window
      }
    })
  })

  describe('get_draft_window_config', function () {
    // seasons.draft_start is timestamptz, so a real row carries a Date here;
    // get_draft_window_config is the boundary that turns it back into the epoch
    // seconds getDraftWindow does arithmetic on.
    const season_row = {
      draft_start: new Date(draft_start_timestamp * 1000),
      draft_type: 'hour',
      draft_pick_interval: 1,
      draft_hour_min: 9,
      draft_hour_max: 22
    }

    it('maps the persisted season columns onto the window arguments', () => {
      expect(get_draft_window_config(season_row)).to.deep.equal({
        draft_start_timestamp,
        cadence_unit: 'hour',
        cadence_interval: 1,
        daily_window_start_hour: 9,
        daily_window_end_hour: 22
      })
    })

    it('passes draft_pick_interval through as cadence_interval', () => {
      expect(
        get_draft_window_config({ ...season_row, draft_pick_interval: 4 })
          .cadence_interval
      ).to.equal(4)
    })

    it('produces the 2026 windows when spread into getDraftWindow', () => {
      expect(
        format(
          getDraftWindow({
            ...get_draft_window_config(season_row),
            pick_number: 58
          })
        )
      ).to.equal('2026-08-26 14:00')
    })
  })
})
