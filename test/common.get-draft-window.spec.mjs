/* global describe it after */

import * as chai from 'chai'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import MockDate from 'mockdate'

import { getDraftWindow, getDraftDates, isDraftWindowOpen } from '#libs-shared'
import get_draft_window_config from '#libs-shared/get-draft-window-config.mjs'

dayjs.extend(utc)
dayjs.extend(timezone)
chai.should()
const expect = chai.expect

const DRAFT_TIMEZONE = 'America/New_York'

// Fixed dates rather than "today" — the daily window and the overnight
// rollover make these assertions sensitive to both DST and the wall-clock time
// the suite happens to run at.
const eastern = (date_string) => dayjs.tz(date_string, DRAFT_TIMEZONE)

// A fixed draft start for the pure-function assertions below. The live 2026
// schedule is pinned separately under '2026 rookie draft projection'.
const draft_start_timestamp = eastern('2026-08-22 00:00').unix()

// A fixed hourly window fixture (09:00 through 21:00 ET), not the live 2026
// setting.
const hourly_9_to_22 = {
  draft_start_timestamp,
  cadence_unit: 'hour',
  daily_window_start_hour: 9,
  daily_window_end_hour: 22
}

// The settings elected for the 2026 rookie draft
// (db/adhoc/2026-08-02-set-2026-draft-schedule.sql): hour cadence, four-hour
// pick clock, 11am–11pm ET daily window, opening Wed Aug 12.
const live_2026 = {
  draft_start_timestamp: eastern('2026-08-12 00:00').unix(),
  cadence_unit: 'hour',
  cadence_interval: 4,
  daily_window_start_hour: 11,
  daily_window_end_hour: 23
}

const format = (window) => window.format('YYYY-MM-DD HH:mm')

// A board whose picks 1..made_through are all made, the last of them at
// `last_selection` and each earlier one an hour before it, with the rest unmade.
// The calculator takes the whole board because a pick's reference is the last
// selection BEFORE it, not a single precomputed pick.
const board_made_through = ({ made_through, last_selection, total = 70 }) =>
  Array.from({ length: total }, (unused, index) => {
    const pick = index + 1
    if (pick > made_through) return { pick }
    return {
      pick,
      pid: `PICK-${pick}`,
      selection_timestamp: last_selection
        .subtract(made_through - pick, 'hour')
        .toDate()
    }
  })

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

  describe('mid-draft, measured from the last selection before the pick', function () {
    // draft.selection_timestamp is timestamptz, so the calculator takes the
    // instant rather than epoch seconds.
    const last_selection = eastern('2026-08-25 14:37')
    const draft_picks = board_made_through({
      made_through: 29,
      last_selection
    })
    const mid_draft = { ...hourly_9_to_22, draft_picks }

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
      // Regression: the hourly path ignored where the reference sat in the board
      // and advanced by pick_number - 1 hours from midnight of the last pick's
      // day, so making a pick pushed the next team's window HOURS INTO THE
      // FUTURE instead of opening it. Deep in the draft the error approached two
      // days.
      expect(getDraftWindow({ ...mid_draft, pick_number: 30 }).unix()).to.equal(
        last_selection.unix()
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
          draft_picks: [
            {
              pick: 29,
              pid: 'PICK-29',
              selection_timestamp: eastern('2026-08-25 14:37').unix()
            }
          ]
        })
      ).to.throw(/expected a Date or an ISO string/)
    })

    it('skips the overnight gap', () => {
      const after_hours = {
        ...hourly_9_to_22,
        draft_picks: board_made_through({
          made_through: 29,
          last_selection: eastern('2026-08-25 21:30')
        })
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
            draft_picks
          })
        )
      ).to.equal('2026-08-26 14:37')
    })

    it('an already-made pick measures from the selection before it', () => {
      // The board makes this total: there is no inconsistent-caller case left to
      // fall back from, because the reference is derived from the board rather
      // than handed in and so cannot disagree with it.
      expect(
        format(getDraftWindow({ ...mid_draft, pick_number: 29 }))
      ).to.equal('2026-08-25 13:37')
    })

    it('counts unmade picks, so a pick taken out of order consumes no step', () => {
      // The live 2026 shape on 8/12: picks 1 and 2 made in sequence, 3 stalled,
      // then 4 and 5 JUMPED that evening. Anchoring on the last gap-free pick
      // measured everything behind from pick 2 at 07:56 that morning, so pick 7
      // landed at 15:00 the next day. The last selection before pick 7 is pick
      // 5's, and only pick 6 is unmade between them, so pick 7 is one step past
      // 19:11 — which crosses the 23:00 close and lands at the next open hour.
      const jumped_board = [
        {
          pick: 1,
          pid: 'P1',
          selection_timestamp: eastern('2026-08-12 05:35').toDate()
        },
        {
          pick: 2,
          pid: 'P2',
          selection_timestamp: eastern('2026-08-12 07:56').toDate()
        },
        { pick: 3 },
        {
          pick: 4,
          pid: 'P4',
          selection_timestamp: eastern('2026-08-12 19:14').toDate()
        },
        {
          pick: 5,
          pid: 'P5',
          selection_timestamp: eastern('2026-08-12 19:11').toDate()
        },
        { pick: 6 },
        { pick: 7 },
        { pick: 8 }
      ]
      const jumped = { ...live_2026, draft_picks: jumped_board }

      // Pick 3 is still measured from pick 2 — the jumps are ahead of it.
      expect(format(getDraftWindow({ ...jumped, pick_number: 3 }))).to.equal(
        '2026-08-12 11:00'
      )
      // Pick 6 is in sequence behind the jumped pick 5, so it is open on the
      // instant that jump landed rather than at 11:00 the next day.
      expect(format(getDraftWindow({ ...jumped, pick_number: 6 }))).to.equal(
        '2026-08-12 19:11'
      )
      expect(format(getDraftWindow({ ...jumped, pick_number: 7 }))).to.equal(
        '2026-08-13 11:00'
      )
      expect(format(getDraftWindow({ ...jumped, pick_number: 8 }))).to.equal(
        '2026-08-13 15:00'
      )
    })

    it('absorbs a hole in the pick numbering', () => {
      // A decommissioned team's pick is removed from the board outright, so the
      // step count has to come from the rows that are there rather than from
      // arithmetic on pick numbers.
      const holed_board = [
        {
          pick: 1,
          pid: 'P1',
          selection_timestamp: eastern('2026-08-25 14:37').toDate()
        },
        // pick 2 belonged to a decommissioned team and is gone
        { pick: 3 },
        { pick: 4 }
      ]
      expect(
        format(
          getDraftWindow({
            ...hourly_9_to_22,
            draft_picks: holed_board,
            pick_number: 4
          })
        )
      ).to.equal('2026-08-25 15:37')
    })
  })

  describe('2026 rookie draft projection (live config)', function () {
    // The 08-02 election: Aug 12 start, four-hour pick clock, 11am–11pm ET
    // window — three slots a day, so 65 picks span Aug 12 through Sep 2.
    it('opens the first and final windows on the elected cadence', () => {
      expect(format(getDraftWindow({ ...live_2026, pick_number: 1 }))).to.equal(
        '2026-08-12 11:00'
      )
      expect(
        format(getDraftWindow({ ...live_2026, pick_number: 58 }))
      ).to.equal('2026-08-31 11:00')
      expect(
        format(getDraftWindow({ ...live_2026, pick_number: 65 }))
      ).to.equal('2026-09-02 15:00')
    })

    it('orders every window strictly and inside the daily window', () => {
      let previous_window = null

      for (let pick_number = 1; pick_number <= 65; pick_number++) {
        const window = getDraftWindow({ ...live_2026, pick_number })
        expect(window.hour()).to.be.at.least(11)
        expect(window.hour()).to.be.below(23)
        if (previous_window) {
          expect(window.isAfter(previous_window)).to.equal(true)
        }
        previous_window = window
      }
    })

    it('projects a hard end the day after the final window for a 65-pick board', () => {
      const { draftEnd } = getDraftDates({ ...live_2026, total_picks: 65 })
      expect(format(draftEnd)).to.equal('2026-09-02 23:59')
    })
  })

  describe('get_draft_window_config', function () {
    // The live 2026 season row. seasons.draft_start is timestamptz, so a real
    // row carries a Date here; get_draft_window_config is the boundary that
    // turns it back into the epoch seconds getDraftWindow does arithmetic on.
    const season_row = {
      draft_start: eastern('2026-08-12 00:00').toDate(),
      draft_type: 'hour',
      draft_pick_interval: 4,
      draft_hour_min: 11,
      draft_hour_max: 23
    }

    it('maps the persisted season columns onto the window arguments', () => {
      expect(get_draft_window_config(season_row)).to.deep.equal({
        draft_start_timestamp: live_2026.draft_start_timestamp,
        cadence_unit: 'hour',
        cadence_interval: 4,
        daily_window_start_hour: 11,
        daily_window_end_hour: 23,
        // A season row with no attached pause history maps to no credit.
        draft_pause_periods: []
      })
    })

    it('passes draft_pick_interval through as cadence_interval', () => {
      expect(
        get_draft_window_config({ ...season_row, draft_pick_interval: 2 })
          .cadence_interval
      ).to.equal(2)
    })

    it('produces the 2026 windows when spread into getDraftWindow', () => {
      expect(
        format(
          getDraftWindow({
            ...get_draft_window_config(season_row),
            pick_number: 65
          })
        )
      ).to.equal('2026-09-02 15:00')
    })
  })

  describe('draft end is anchored to the final pick', function () {
    // getDraftDates treats a non-null last_selection_timestamp as
    // authoritative and returns endOf('day') of it. The draft route and the
    // expiry sweep therefore pass the FINAL pick's selection — null until the
    // last pick is made — so a stalled draft keeps its projected cadence end.
    // Passing the most recent selection by TIME instead collapses draftEnd to
    // that pick's own day and closes a stalled draft the day after its last
    // pick landed. These specs pin that distinction so the sweep cannot
    // regress to the wrong anchor.
    it('projects the cadence end while the final pick is unmade', () => {
      const { draftEnd } = getDraftDates({
        ...live_2026,
        total_picks: 65,
        last_selection_timestamp: null
      })
      expect(format(draftEnd)).to.equal('2026-09-02 23:59')
    })

    it('collapses to the day of a mid-draft selection when one is passed', () => {
      const { draftEnd } = getDraftDates({
        ...live_2026,
        total_picks: 65,
        last_selection_timestamp: '2026-08-12T11:56:24.804Z'
      })
      expect(format(draftEnd)).to.equal('2026-08-12 23:59')
    })

    it('returns the day of the final selection once the last pick is made', () => {
      const { draftEnd } = getDraftDates({
        ...live_2026,
        total_picks: 65,
        last_selection_timestamp: eastern('2026-09-02 15:00').toDate()
      })
      expect(format(draftEnd)).to.equal('2026-09-02 23:59')
    })
  })

  describe('isDraftWindowOpen — jumps are gated to the daily window', function () {
    // The live 2026 draft: pick 1.2 made 07:56 on 8/12. Pick 1.4 is a JUMP
    // whose window opened 15:00 on 8/12; once that moment has passed it must
    // not be jumpable again until inside the daily window hours on a later day
    // (the operator's rule: a team on the clock since the previous day cannot
    // be jumped until the next day's window start).
    const draft_picks = board_made_through({
      made_through: 2,
      last_selection: eastern('2026-08-12 07:56'),
      total: 8
    })
    const jump_open_at = (eastern_wall_clock) => {
      MockDate.set(eastern(eastern_wall_clock).toISOString())
      return isDraftWindowOpen({
        ...live_2026,
        draft_picks,
        pick_number: 4
      })
    }

    after(() => MockDate.reset())

    it('is open inside the daily window once the window moment has passed', () => {
      expect(jump_open_at('2026-08-12 15:30')).to.equal(true)
    })

    it('is closed before the window moment, even inside the daily window', () => {
      expect(jump_open_at('2026-08-12 14:59')).to.equal(false)
    })

    it('is closed after the daily window closes, even with the moment passed', () => {
      expect(jump_open_at('2026-08-12 23:30')).to.equal(false)
    })

    it('is closed overnight before the next day window start', () => {
      expect(jump_open_at('2026-08-13 06:00')).to.equal(false)
      expect(jump_open_at('2026-08-13 10:59')).to.equal(false)
    })

    it('reopens at the next day window start', () => {
      expect(jump_open_at('2026-08-13 11:00')).to.equal(true)
    })

    it('gives the on-clock team at least the interval before the first jumper', () => {
      // Operator rule 2: every team gets at least cadence_interval hours on the
      // clock before the first jumper's window, across references spread over
      // the day (including the overnight rollover).
      for (const ref of [
        '2026-08-12 11:00',
        '2026-08-12 18:00',
        '2026-08-12 19:00',
        '2026-08-12 21:00'
      ]) {
        const board = board_made_through({
          made_through: 5,
          last_selection: eastern(ref),
          total: 10
        })
        const onclock = getDraftWindow({
          ...live_2026,
          draft_picks: board,
          pick_number: 6
        })
        const jumper = getDraftWindow({
          ...live_2026,
          draft_picks: board,
          pick_number: 7
        })
        expect(jumper.diff(onclock, 'hour', true)).to.be.at.least(
          live_2026.cadence_interval
        )
      }
    })
  })

  describe('league pause credit', function () {
    const pause = (paused_at, resumed_at = null) => ({
      paused_at: eastern(paused_at).toISOString(),
      resumed_at: resumed_at ? eastern(resumed_at).toISOString() : null
    })

    // A twelve-open-hour pause covering the whole of Tuesday's band.
    const tuesday_pause = [pause('2026-08-11 11:00', '2026-08-11 23:00')]

    const window_for = ({ pick_number, draft_picks, periods, until }) =>
      getDraftWindow({
        ...live_2026,
        draft_picks,
        pick_number,
        draft_pause_periods: periods,
        until: until ? eastern(until) : undefined
      })

    it('places a window unchanged when there are no pauses', () => {
      const draft_picks = board_made_through({
        made_through: 5,
        last_selection: eastern('2026-08-12 14:00'),
        total: 10
      })

      expect(
        format(window_for({ pick_number: 6, draft_picks, periods: [] }))
      ).to.equal(
        format(getDraftWindow({ ...live_2026, draft_picks, pick_number: 6 }))
      )
    })

    describe('the compounding fixture', function () {
      // The case the whole clipped design turns on. A scalar credit measured
      // from `draft_start` is added to a reference that already POSTDATES the
      // pause, so every pick after a resume is charged the full pause again —
      // and because each over-late window delays the selection anchoring the
      // pick behind it, the error compounds down the board.
      it('does not charge a pick whose reference postdates the pause', () => {
        const draft_picks = board_made_through({
          made_through: 5,
          last_selection: eastern('2026-08-12 14:00'),
          total: 10
        })

        // Under a from-draft_start scalar this would be Thu 14:00.
        expect(
          format(
            window_for({
              pick_number: 6,
              draft_picks,
              periods: tuesday_pause,
              until: '2026-08-12 15:00'
            })
          )
        ).to.equal('2026-08-12 14:00')
      })

      it('does not charge the SECOND pick after the resume either', () => {
        // The distinguishing input: a single-pick fixture cannot tell a clipped
        // credit from an unclipped one.
        const draft_picks = board_made_through({
          made_through: 6,
          last_selection: eastern('2026-08-13 15:00'),
          total: 10
        })

        // Under a from-draft_start scalar this would be Fri 15:00.
        expect(
          format(
            window_for({
              pick_number: 7,
              draft_picks,
              periods: tuesday_pause,
              until: '2026-08-13 16:00'
            })
          )
        ).to.equal('2026-08-13 15:00')
      })
    })

    describe('a pause the pick actually waited through', function () {
      it('shifts the window by the pause open time', () => {
        const draft_picks = board_made_through({
          made_through: 5,
          last_selection: eastern('2026-08-11 09:00'),
          total: 10
        })

        // Reference 09:00 snaps to the band at 11:00; the pause then runs the
        // whole band, so the window moves a full band forward to Wed 11:00.
        expect(
          format(
            window_for({
              pick_number: 6,
              draft_picks,
              periods: tuesday_pause,
              until: '2026-08-12 12:00'
            })
          )
        ).to.equal('2026-08-12 11:00')
      })

      it('credits only the portion of the pause after the reference', () => {
        const draft_picks = board_made_through({
          made_through: 5,
          last_selection: eastern('2026-08-11 15:00'),
          total: 10
        })

        // Reference Tue 15:00, pause runs to Tue 23:00 — eight open hours. The
        // window moves from Tue 15:00 to Wed 11:00 (eight open hours later).
        expect(
          format(
            window_for({
              pick_number: 6,
              draft_picks,
              periods: tuesday_pause,
              until: '2026-08-12 12:00'
            })
          )
        ).to.equal('2026-08-12 11:00')
      })
    })

    describe('an open pause', function () {
      // A pause with a null `resumed_at` is measured to the caller's now, which
      // is what holds a pick's remaining time still instead of letting it tick
      // down while nobody is allowed to draft.
      it('freezes a pick clock for the duration of the pause', () => {
        const draft_picks = board_made_through({
          made_through: 1,
          last_selection: eastern('2026-08-12 11:30'),
          total: 10
        })
        const open_pause = [pause('2026-08-12 12:00')]

        const remaining_at = (now) => {
          const window = window_for({
            pick_number: 2,
            draft_picks,
            periods: open_pause,
            until: now
          })
          return window
            .add(live_2026.cadence_interval, 'hour')
            .diff(eastern(now), 'minute')
        }

        expect(remaining_at('2026-08-12 12:00')).to.equal(210)
        expect(remaining_at('2026-08-12 14:00')).to.equal(210)
        expect(remaining_at('2026-08-12 18:00')).to.equal(210)
        expect(remaining_at('2026-08-13 12:00')).to.equal(210)
      })
    })

    describe('a day cadence', function () {
      it('is not credited, since a day step is not open time', () => {
        const draft_picks = board_made_through({
          made_through: 1,
          last_selection: eastern('2026-08-11 14:00'),
          total: 10
        })
        const day_config = { ...live_2026, cadence_unit: 'day' }

        const uncredited = getDraftWindow({
          ...day_config,
          draft_picks,
          pick_number: 2
        })
        const credited = getDraftWindow({
          ...day_config,
          draft_picks,
          pick_number: 2,
          draft_pause_periods: tuesday_pause,
          until: eastern('2026-08-14 12:00')
        })

        expect(format(credited)).to.equal(format(uncredited))
      })
    })

    describe('population check: minute preservation', function () {
      // A single-anchor fixture cannot distinguish a minute-preserving advance
      // from an hour-granular one, which is how the first draft of this design
      // carried a 59-minute defect. Sweep every anchor minute.
      it('preserves the anchor minutes at all 60 anchor minutes', () => {
        const band_pause = [pause('2026-08-12 11:00', '2026-08-12 23:00')]

        for (let minute = 0; minute < 60; minute++) {
          const last_selection = eastern(
            `2026-08-12 10:${String(minute).padStart(2, '0')}`
          )
          const draft_picks = board_made_through({
            made_through: 2,
            last_selection,
            total: 10
          })

          const uncredited = getDraftWindow({
            ...live_2026,
            draft_picks,
            pick_number: 4
          })
          const credited = getDraftWindow({
            ...live_2026,
            draft_picks,
            pick_number: 4,
            draft_pause_periods: band_pause,
            until: eastern('2026-08-13 12:00')
          })

          expect(
            credited.minute(),
            `anchor minute ${minute} lost its minutes`
          ).to.equal(uncredited.minute())
        }
      })

      it('applies the credit AFTER the cadence steps, not to the reference', () => {
        // Applying the credit to the reference and stepping afterwards re-feeds
        // the credited anchor through the hour-granular step walker, which
        // snaps to the top of the hour whenever a step crosses the overnight
        // gap — truncating exactly the minutes the seconds credit preserves.
        // Reference 11:59 with one step and an eight-open-hour credit is the
        // worst measured case: 59 minutes.
        const draft_picks = board_made_through({
          made_through: 1,
          last_selection: eastern('2026-08-12 11:59'),
          total: 10
        })

        const credited = getDraftWindow({
          ...live_2026,
          draft_picks,
          pick_number: 3,
          draft_pause_periods: [pause('2026-08-12 12:00', '2026-08-12 20:00')],
          until: eastern('2026-08-13 12:00')
        })

        expect(credited.minute()).to.equal(59)
      })
    })

    describe('population check: the clip across a whole draft', function () {
      // A single-pick fixture cannot distinguish a clipped credit from an
      // unclipped one. Walk a run of picks made after a resume and assert each
      // window equals the unpaused schedule — the pause is wholly before every
      // reference, so it must be credited exactly zero times, not once per pick.
      it('charges a pause exactly once, never once per pick', () => {
        for (let made_through = 3; made_through <= 12; made_through++) {
          const last_selection = eastern('2026-08-12 12:00').add(
            made_through,
            'hour'
          )
          const draft_picks = board_made_through({
            made_through,
            last_selection,
            total: 20
          })

          const unpaused = getDraftWindow({
            ...live_2026,
            draft_picks,
            pick_number: made_through + 1
          })
          const paused = getDraftWindow({
            ...live_2026,
            draft_picks,
            pick_number: made_through + 1,
            draft_pause_periods: tuesday_pause,
            until: last_selection.add(1, 'hour')
          })

          expect(
            format(paused),
            `pick ${made_through + 1} was charged for a pause it never waited through`
          ).to.equal(format(unpaused))
        }
      })
    })
  })
})

describe('LIBS-SHARED get_draft_window_config pause periods', function () {
  it('passes the pause intervals through to the calculator', () => {
    const config = get_draft_window_config({
      draft_start: eastern('2026-08-12 00:00').toDate(),
      draft_type: 'hour',
      draft_pick_interval: 4,
      draft_hour_min: 11,
      draft_hour_max: 23,
      draft_pause_periods: [
        { paused_at: '2026-08-11T15:00:00.000Z', resumed_at: null }
      ]
    })

    expect(config.draft_pause_periods).to.deep.equal([
      { paused_at: '2026-08-11T15:00:00.000Z', resumed_at: null }
    ])
  })

  it('yields an empty array when the league carries no pause field', () => {
    // A call site whose league lacks the field must credit nothing rather than
    // throw — this is the shape every unpaused league has.
    const config = get_draft_window_config({
      draft_start: eastern('2026-08-12 00:00').toDate(),
      draft_type: 'hour',
      draft_pick_interval: 4,
      draft_hour_min: 11,
      draft_hour_max: 23
    })

    expect(config.draft_pause_periods).to.deep.equal([])
  })
})
