/* global describe it */

import * as chai from 'chai'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

import get_paused_open_seconds from '#libs-shared/get-paused-open-seconds.mjs'
import { DRAFT_TIMEZONE } from '#libs-shared/draft-daily-window.mjs'

dayjs.extend(utc)
dayjs.extend(timezone)
chai.should()
const expect = chai.expect

const eastern = (date_string) => dayjs.tz(date_string, DRAFT_TIMEZONE)

// The live 2026 rookie draft band: 11am through 11pm ET.
const live_band = {
  daily_window_start_hour: 11,
  daily_window_end_hour: 23
}

const HOUR = 3600

const period = (paused_at, resumed_at = null) => ({
  paused_at: eastern(paused_at).toISOString(),
  resumed_at: resumed_at ? eastern(resumed_at).toISOString() : null
})

describe('LIBS-SHARED get_paused_open_seconds', function () {
  describe('the clip', function () {
    it('credits nothing for a pause that ended entirely before `from`', () => {
      // This is the case the compounding defect turns on. Mid-draft the
      // reference is the previous selection's timestamp, so a pause that closed
      // before it was already absorbed by whoever was on the clock then.
      // Crediting it charges every later pick the whole pause.
      const seconds = get_paused_open_seconds({
        draft_pause_periods: [period('2026-08-11 11:00', '2026-08-11 23:00')],
        from: eastern('2026-08-12 14:00'),
        until: eastern('2026-08-14 14:00'),
        ...live_band
      })

      expect(seconds).to.equal(0)
    })

    it('credits nothing for a pause that starts entirely after `until`', () => {
      const seconds = get_paused_open_seconds({
        draft_pause_periods: [period('2026-08-14 11:00', '2026-08-14 23:00')],
        from: eastern('2026-08-12 11:00'),
        until: eastern('2026-08-13 11:00'),
        ...live_band
      })

      expect(seconds).to.equal(0)
    })

    it('credits only the part of a pause that follows `from`', () => {
      // Pause runs the whole band; the reference lands four hours into it, so
      // only the remaining eight hours are this pick's to reclaim.
      const seconds = get_paused_open_seconds({
        draft_pause_periods: [period('2026-08-12 11:00', '2026-08-12 23:00')],
        from: eastern('2026-08-12 15:00'),
        until: eastern('2026-08-13 11:00'),
        ...live_band
      })

      expect(seconds).to.equal(8 * HOUR)
    })

    it('credits only the part of a pause that precedes `until`', () => {
      const seconds = get_paused_open_seconds({
        draft_pause_periods: [period('2026-08-12 11:00', '2026-08-12 23:00')],
        from: eastern('2026-08-12 11:00'),
        until: eastern('2026-08-12 14:30'),
        ...live_band
      })

      expect(seconds).to.equal(3.5 * HOUR)
    })
  })

  describe('the band', function () {
    it('credits nothing for a pause wholly inside closed hours', () => {
      const seconds = get_paused_open_seconds({
        draft_pause_periods: [period('2026-08-11 23:30', '2026-08-12 06:00')],
        from: eastern('2026-08-10 11:00'),
        until: eastern('2026-08-20 11:00'),
        ...live_band
      })

      expect(seconds).to.equal(0)
    })

    it('counts only open hours across an overnight pause', () => {
      // 20:00 Tue through 14:00 Wed: three open hours Tuesday evening, three
      // Wednesday morning. The overnight gap counts for nothing.
      const seconds = get_paused_open_seconds({
        draft_pause_periods: [period('2026-08-11 20:00', '2026-08-12 14:00')],
        from: eastern('2026-08-10 11:00'),
        until: eastern('2026-08-20 11:00'),
        ...live_band
      })

      expect(seconds).to.equal(6 * HOUR)
    })

    it('counts a multi-day pause one band per day', () => {
      const seconds = get_paused_open_seconds({
        draft_pause_periods: [period('2026-08-11 11:00', '2026-08-14 23:00')],
        from: eastern('2026-08-10 11:00'),
        until: eastern('2026-08-20 11:00'),
        ...live_band
      })

      expect(seconds).to.equal(4 * 12 * HOUR)
    })

    it('preserves sub-hour precision', () => {
      const seconds = get_paused_open_seconds({
        draft_pause_periods: [period('2026-08-12 11:17', '2026-08-12 12:43')],
        from: eastern('2026-08-10 11:00'),
        until: eastern('2026-08-20 11:00'),
        ...live_band
      })

      expect(seconds).to.equal(86 * 60)
    })
  })

  describe('an open pause', function () {
    it('runs to `until` when `resumed_at` is null', () => {
      const seconds = get_paused_open_seconds({
        draft_pause_periods: [period('2026-08-12 12:00')],
        from: eastern('2026-08-12 11:00'),
        until: eastern('2026-08-12 17:00'),
        ...live_band
      })

      expect(seconds).to.equal(5 * HOUR)
    })

    it('grows with `until`, which is what freezes a live pick clock', () => {
      // As now advances through a pause the credit advances at exactly the same
      // rate, so the remaining time on a pick holds still rather than ticking
      // down. A scalar snapshot cannot do this.
      const at = (until) =>
        get_paused_open_seconds({
          draft_pause_periods: [period('2026-08-12 12:00')],
          from: eastern('2026-08-12 11:00'),
          until: eastern(until),
          ...live_band
        })

      expect(at('2026-08-12 14:00')).to.equal(2 * HOUR)
      expect(at('2026-08-12 16:00')).to.equal(4 * HOUR)
      expect(at('2026-08-13 12:00')).to.equal(12 * HOUR)
    })
  })

  describe('multiple periods', function () {
    it('sums separate pauses', () => {
      const seconds = get_paused_open_seconds({
        draft_pause_periods: [
          period('2026-08-11 11:00', '2026-08-11 14:00'),
          period('2026-08-12 15:00', '2026-08-12 18:00')
        ],
        from: eastern('2026-08-10 11:00'),
        until: eastern('2026-08-20 11:00'),
        ...live_band
      })

      expect(seconds).to.equal(6 * HOUR)
    })

    it('clips each period independently against `from`', () => {
      const seconds = get_paused_open_seconds({
        draft_pause_periods: [
          period('2026-08-11 11:00', '2026-08-11 14:00'),
          period('2026-08-12 15:00', '2026-08-12 18:00')
        ],
        from: eastern('2026-08-12 16:00'),
        until: eastern('2026-08-20 11:00'),
        ...live_band
      })

      expect(seconds).to.equal(2 * HOUR)
    })
  })

  describe('the November DST boundary', function () {
    it('counts wall-clock band hours on both sides of the fall-back', () => {
      // 2026-11-01 is the fall-back. The daily window is a WALL-CLOCK band, so
      // each day contributes twelve wall-clock hours regardless of the
      // transition — the day itself is 25 absolute hours long, and the extra
      // hour lands at 01:00, outside the band.
      const seconds = get_paused_open_seconds({
        draft_pause_periods: [period('2026-10-31 11:00', '2026-11-02 23:00')],
        from: eastern('2026-10-01 11:00'),
        until: eastern('2026-12-01 11:00'),
        ...live_band
      })

      expect(seconds).to.equal(3 * 12 * HOUR)
    })

    it('counts a band-only pause identically before and after the transition', () => {
      const before = get_paused_open_seconds({
        draft_pause_periods: [period('2026-10-30 11:00', '2026-10-30 23:00')],
        from: eastern('2026-10-01 11:00'),
        until: eastern('2026-12-01 11:00'),
        ...live_band
      })
      const after = get_paused_open_seconds({
        draft_pause_periods: [period('2026-11-03 11:00', '2026-11-03 23:00')],
        from: eastern('2026-10-01 11:00'),
        until: eastern('2026-12-01 11:00'),
        ...live_band
      })

      expect(before).to.equal(12 * HOUR)
      expect(after).to.equal(12 * HOUR)
    })
  })

  describe('refusals and degenerate input', function () {
    it('throws on a day cadence', () => {
      // The credit unit and a day step do not measure the same thing: a day
      // step holds its time of day across the step. Returning a number here
      // would mean something different than the caller assumes.
      expect(() =>
        get_paused_open_seconds({
          draft_pause_periods: [period('2026-08-12 11:00', '2026-08-12 23:00')],
          from: eastern('2026-08-10 11:00'),
          until: eastern('2026-08-20 11:00'),
          cadence_unit: 'day',
          ...live_band
        })
      ).to.throw(/day cadence/)
    })

    it('returns 0 for no periods', () => {
      expect(
        get_paused_open_seconds({
          draft_pause_periods: [],
          from: eastern('2026-08-10 11:00'),
          until: eastern('2026-08-20 11:00'),
          ...live_band
        })
      ).to.equal(0)
    })

    it('returns 0 when `until` precedes `from`', () => {
      expect(
        get_paused_open_seconds({
          draft_pause_periods: [period('2026-08-12 11:00', '2026-08-12 23:00')],
          from: eastern('2026-08-20 11:00'),
          until: eastern('2026-08-10 11:00'),
          ...live_band
        })
      ).to.equal(0)
    })

    it('skips a period with an unparseable bound rather than throwing', () => {
      expect(
        get_paused_open_seconds({
          draft_pause_periods: [
            { paused_at: null, resumed_at: null },
            period('2026-08-12 11:00', '2026-08-12 14:00')
          ],
          from: eastern('2026-08-10 11:00'),
          until: eastern('2026-08-20 11:00'),
          ...live_band
        })
      ).to.equal(3 * HOUR)
    })
  })
})
