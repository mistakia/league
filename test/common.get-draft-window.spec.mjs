/* global describe it */

import * as chai from 'chai'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

import {
  getDraftWindow,
  getDraftDates,
  get_draft_pass_window,
  get_next_publication_boundary
} from '#libs-shared'
import { get_publication_boundary } from '#libs-shared/draft-window/publication-boundaries.mjs'
import get_draft_window_config from '#libs-shared/get-draft-window-config.mjs'

dayjs.extend(utc)
dayjs.extend(timezone)
chai.should()
const expect = chai.expect

const DRAFT_TIMEZONE = 'America/New_York'

// Fixed dates rather than "today". Every assertion here is about a wall-clock
// hour on a particular date, so both DST and the time the suite happens to run
// at would otherwise move the answers.
const eastern = (date_string) => dayjs.tz(date_string, DRAFT_TIMEZONE)
const format = (window) =>
  window === null ? null : window.tz(DRAFT_TIMEZONE).format('YYYY-MM-DD HH:mm')

// The settings elected for the 2026 rookie draft: a 3-hour interval on an
// 11:00-24:00 Eastern band, which seats five slots a day at 11, 14, 17, 20 and
// 23 and closes at midnight. The draft opened Wed Aug 12.
const live_2026 = {
  draft_start_timestamp: eastern('2026-08-12 00:00').unix(),
  pick_interval_hours: 3,
  daily_window_start_hour: 11,
  daily_window_end_hour: 24
}

// The constitutional cadence: a full-day band with a 24-hour interval, which
// puts one window a day at midnight.
const article_xi_section_8 = {
  draft_start_timestamp: eastern('2026-09-01 00:00').unix(),
  pick_interval_hours: 24,
  daily_window_start_hour: 0,
  daily_window_end_hour: 24
}

// A board of `total` picks, unmade except for the entries in `made`, which maps
// a pick number to its selection instant. The calculator takes the WHOLE board
// because a pick's placement depends on which picks ahead of it are unmade.
const board = ({ total = 12, made = {} } = {}) =>
  Array.from({ length: total }, (unused, index) => {
    const pick = index + 1
    const selected_at = made[pick]
    if (!selected_at) return { pick, pid: null, selection_timestamp: null }
    return {
      pick,
      pid: `PICK-${pick}`,
      selection_timestamp: eastern(selected_at).toDate()
    }
  })

const window_for = (args) => format(getDraftWindow(args))

describe('LIBS-SHARED get_publication_boundary', function () {
  it('is null before the draft opens', () => {
    expect(
      get_publication_boundary({
        ...live_2026,
        until: eastern('2026-08-11 23:00')
      })
    ).to.equal(null)
  })

  it('is the draft opening until the band first closes', () => {
    expect(
      format(
        get_publication_boundary({
          ...live_2026,
          until: eastern('2026-08-12 20:00')
        })
      )
    ).to.equal('2026-08-12 00:00')
  })

  it('is the latest daily close once one has happened', () => {
    expect(
      format(
        get_publication_boundary({
          ...live_2026,
          until: eastern('2026-08-15 20:00')
        })
      )
    ).to.equal('2026-08-15 00:00')
  })

  it('is the first close at or after a resume, effective immediately', () => {
    // The resume seeds an initial publication at the first close at or after
    // it, so the lead-up has a board rather than a void.
    expect(
      format(
        get_publication_boundary({
          ...live_2026,
          resumed_at: eastern('2026-08-17 09:00').toDate(),
          until: eastern('2026-08-17 23:59')
        })
      )
    ).to.equal('2026-08-18 00:00')
  })

  describe('the resume comparison is >=, to the second', function () {
    it('publishes a close landing exactly on the resume', () => {
      expect(
        format(
          get_publication_boundary({
            ...live_2026,
            resumed_at: eastern('2026-08-18 00:00').toDate(),
            until: eastern('2026-08-18 09:00')
          })
        )
      ).to.equal('2026-08-18 00:00')
    })

    it('withholds one landing a second before it, seeding the next close', () => {
      // The close a second before the resume is not adopted; the first close
      // at or after it becomes the initial publication.
      expect(
        format(
          get_publication_boundary({
            ...live_2026,
            resumed_at: eastern('2026-08-18 00:00:01').toDate(),
            until: eastern('2026-08-18 09:00')
          })
        )
      ).to.equal('2026-08-19 00:00')
    })
  })
})

describe('LIBS-SHARED getDraftWindow', function () {
  describe('the slot grid is fixed and repeats every day', function () {
    const args = {
      ...live_2026,
      draft_picks: board({ total: 12 }),
      until: eastern('2026-08-12 09:00')
    }

    it('seats the day at the band hours', () => {
      expect(window_for({ ...args, pick_number: 1 })).to.equal(
        '2026-08-12 11:00'
      )
      expect(window_for({ ...args, pick_number: 2 })).to.equal(
        '2026-08-12 14:00'
      )
      expect(window_for({ ...args, pick_number: 3 })).to.equal(
        '2026-08-12 17:00'
      )
      expect(window_for({ ...args, pick_number: 4 })).to.equal(
        '2026-08-12 20:00'
      )
    })

    it('keeps the last slot of the day, which the close does not shorten', () => {
      // A window is an opening, not an interval — nothing closes it at
      // midnight, so the 23:00 pick holds the clock alone until 11:00.
      expect(window_for({ ...args, pick_number: 5 })).to.equal(
        '2026-08-12 23:00'
      )
    })

    it('opens the next day at the band hour, with no carry-over', () => {
      // The overnight gap consumes nothing. An earlier rule walked OPEN hours
      // and put this pick at 13:00, one hour of its interval having been spent
      // closing out the previous evening; the published times then drifted
      // further every day.
      expect(window_for({ ...args, pick_number: 6 })).to.equal(
        '2026-08-13 11:00'
      )
      expect(window_for({ ...args, pick_number: 11 })).to.equal(
        '2026-08-14 11:00'
      )
      expect(window_for({ ...args, pick_number: 12 })).to.equal(
        '2026-08-14 14:00'
      )
    })
  })

  describe('the slate is frozen between two publications', function () {
    const args = {
      ...live_2026,
      draft_picks: board({ total: 12, made: { 1: '2026-08-12 14:30' } }),
      pick_number: 2
    }

    it('does not move when a pick is made during the day', () => {
      expect(
        window_for({ ...args, until: eastern('2026-08-12 09:00') })
      ).to.equal('2026-08-12 14:00')
      expect(
        window_for({ ...args, until: eastern('2026-08-12 20:00') })
      ).to.equal('2026-08-12 14:00')
      expect(
        window_for({ ...args, until: eastern('2026-08-12 23:59') })
      ).to.equal('2026-08-12 14:00')
    })
  })

  describe('a window never moves later', function () {
    const quiet_board = {
      ...live_2026,
      draft_picks: board({ total: 12 }),
      pick_number: 6
    }

    it('holds a published slot through days on which nobody picks', () => {
      // Published Aug 12 for Aug 13 11:00. Three further publications each
      // lay pick 6 a day further out, and the window does not budge.
      expect(
        window_for({ ...quiet_board, until: eastern('2026-08-12 09:00') })
      ).to.equal('2026-08-13 11:00')
      expect(
        window_for({ ...quiet_board, until: eastern('2026-08-13 09:00') })
      ).to.equal('2026-08-13 11:00')
      expect(
        window_for({ ...quiet_board, until: eastern('2026-08-15 09:00') })
      ).to.equal('2026-08-13 11:00')
    })

    it('holds it when fewer picks are made than the day scheduled', () => {
      const one_pick_a_day = board({
        total: 12,
        made: { 1: '2026-08-12 14:30', 2: '2026-08-13 14:30' }
      })
      expect(
        window_for({
          ...quiet_board,
          draft_picks: one_pick_a_day,
          until: eastern('2026-08-14 09:00')
        })
      ).to.equal('2026-08-13 11:00')
    })
  })

  describe('a window moves earlier when a day outruns its slate', function () {
    it('comes up by the surplus at the next publication', () => {
      // Five slots were scheduled for Aug 12 and eight picks were made, so the
      // Aug 13 publication seats pick 12 three slots sooner than the standing
      // one did.
      const args = {
        ...live_2026,
        draft_picks: board({
          total: 12,
          made: {
            1: '2026-08-12 11:05',
            2: '2026-08-12 12:00',
            3: '2026-08-12 13:00',
            4: '2026-08-12 14:00',
            5: '2026-08-12 15:00',
            6: '2026-08-12 16:00',
            7: '2026-08-12 17:00',
            8: '2026-08-12 18:00'
          }
        }),
        pick_number: 12
      }

      expect(
        window_for({ ...args, until: eastern('2026-08-12 09:00') })
      ).to.equal('2026-08-14 14:00')
      expect(
        window_for({ ...args, until: eastern('2026-08-13 09:00') })
      ).to.equal('2026-08-13 20:00')
    })
  })

  describe('selection times place no window', function () {
    const early = board({
      total: 12,
      made: { 1: '2026-08-12 11:05', 2: '2026-08-12 11:10' }
    })
    const late = board({
      total: 12,
      made: { 1: '2026-08-12 22:00', 2: '2026-08-12 23:30' }
    })

    it('gives the same answer however late the picks ahead landed', () => {
      const args = { ...live_2026, until: eastern('2026-08-13 09:00') }
      for (const pick_number of [3, 6, 12]) {
        expect(
          window_for({ ...args, pick_number, draft_picks: early })
        ).to.equal(window_for({ ...args, pick_number, draft_picks: late }))
      }
    })
  })

  describe('a gap board, which is the live 2026 shape', function () {
    // Picks 1, 2, 4 and 5 are made and pick 3 was passed over, so the queue is
    // pick 3 followed by pick 6. A skipped pick still holds its place in line:
    // it consumes a slot, and the picks behind it are seated after it.
    const args = {
      ...live_2026,
      draft_picks: board({
        total: 65,
        made: {
          1: '2026-08-12 05:35',
          2: '2026-08-12 07:56',
          4: '2026-08-12 19:14',
          5: '2026-08-12 19:11'
        }
      }),
      resumed_at: eastern('2026-08-17 09:00').toDate(),
      until: eastern('2026-08-18 09:00')
    }

    it('seats the queue in pick order', () => {
      expect(window_for({ ...args, pick_number: 3 })).to.equal(
        '2026-08-18 11:00'
      )
      expect(window_for({ ...args, pick_number: 6 })).to.equal(
        '2026-08-18 14:00'
      )
      expect(window_for({ ...args, pick_number: 7 })).to.equal(
        '2026-08-18 17:00'
      )
      expect(window_for({ ...args, pick_number: 8 })).to.equal(
        '2026-08-18 20:00'
      )
    })

    it('gives a made pick no window', () => {
      for (const pick_number of [1, 2, 4, 5]) {
        expect(getDraftWindow({ ...args, pick_number })).to.equal(null)
      }
    })

    it('seats a pick number past the end of the board', () => {
      // The draft-end estimate asks for `last_pick.pick + 1`, which is not a
      // row at all. Absent from the board is unmade, not made — answering
      // null here would make every downstream draft-end comparison false.
      expect(window_for({ ...args, pick_number: 66 })).to.equal(
        '2026-08-30 14:00'
      )
    })

    it('fits the whole board inside the announced hard end', () => {
      // 61 picks outstanding at five slots a day from Aug 18, against a hard
      // end of Aug 31 23:59.
      expect(window_for({ ...args, pick_number: 65 })).to.equal(
        '2026-08-30 11:00'
      )
    })
  })

  describe('a resume seeds an initial publication', function () {
    const args = {
      ...live_2026,
      draft_picks: board({ total: 12 }),
      pick_number: 1
    }

    it('gives every pick a window laid from the first close, in the lead-up', () => {
      expect(
        window_for({
          ...args,
          resumed_at: eastern('2026-08-17 09:00').toDate(),
          until: eastern('2026-08-17 23:59')
        })
      ).to.equal('2026-08-18 11:00')
    })

    it('restarts the ratchet, which is the one way a window moves later', () => {
      expect(
        window_for({ ...args, until: eastern('2026-08-18 09:00') })
      ).to.equal('2026-08-12 11:00')
      expect(
        window_for({
          ...args,
          resumed_at: eastern('2026-08-17 09:00').toDate(),
          until: eastern('2026-08-18 09:00')
        })
      ).to.equal('2026-08-18 11:00')
    })
  })

  describe('before the draft and with no board', function () {
    it('is null before the draft opens', () => {
      expect(
        getDraftWindow({
          ...live_2026,
          draft_picks: board({ total: 12 }),
          pick_number: 1,
          until: eastern('2026-08-11 23:00')
        })
      ).to.equal(null)
    })

    it('treats every pick as outstanding with no board', () => {
      expect(
        window_for({
          ...live_2026,
          pick_number: 3,
          until: eastern('2026-08-12 09:00')
        })
      ).to.equal('2026-08-12 17:00')
    })

    it('is null for an invalid pick number', () => {
      const args = {
        ...live_2026,
        draft_picks: board({ total: 12 }),
        until: eastern('2026-08-12 09:00')
      }
      for (const pick_number of [0, -1, NaN, undefined]) {
        expect(getDraftWindow({ ...args, pick_number })).to.equal(null)
      }
    })
  })

  describe('the constitutional cadence', function () {
    it('puts one window a day at midnight', () => {
      const args = {
        ...article_xi_section_8,
        draft_picks: board({ total: 5 }),
        until: eastern('2026-09-01 06:00')
      }
      expect(window_for({ ...args, pick_number: 1 })).to.equal(
        '2026-09-01 00:00'
      )
      expect(window_for({ ...args, pick_number: 2 })).to.equal(
        '2026-09-02 00:00'
      )
      expect(window_for({ ...args, pick_number: 5 })).to.equal(
        '2026-09-05 00:00'
      )
    })
  })

  describe('wall-clock hours hold across both DST transitions', function () {
    it('holds through the November fall-back', () => {
      const args = {
        ...live_2026,
        draft_start_timestamp: eastern('2026-10-30 00:00').unix(),
        draft_picks: board({ total: 12 }),
        until: eastern('2026-10-30 09:00')
      }
      expect(window_for({ ...args, pick_number: 6 })).to.equal(
        '2026-10-31 11:00'
      )
      expect(window_for({ ...args, pick_number: 11 })).to.equal(
        '2026-11-01 11:00'
      )
      expect(window_for({ ...args, pick_number: 12 })).to.equal(
        '2026-11-01 14:00'
      )
    })

    it('holds through the March spring-forward', () => {
      const args = {
        ...live_2026,
        draft_start_timestamp: eastern('2026-03-06 00:00').unix(),
        draft_picks: board({ total: 12 }),
        until: eastern('2026-03-06 09:00')
      }
      expect(window_for({ ...args, pick_number: 6 })).to.equal(
        '2026-03-07 11:00'
      )
      expect(window_for({ ...args, pick_number: 11 })).to.equal(
        '2026-03-08 11:00'
      )
      expect(window_for({ ...args, pick_number: 12 })).to.equal(
        '2026-03-08 14:00'
      )
    })
  })
})

describe('LIBS-SHARED get_draft_pass_window', function () {
  const made = {
    1: '2026-08-12 05:35',
    2: '2026-08-12 07:56',
    4: '2026-08-12 19:14',
    5: '2026-08-12 19:11'
  }
  const args = {
    ...live_2026,
    draft_picks: board({ total: 65, made }),
    resumed_at: eastern('2026-08-17 09:00').toDate(),
    until: eastern('2026-08-18 09:00')
  }

  it('returns the window of the second outstanding pick', () => {
    // `frontier.pick + 1` is pick 4 on this board, which is MADE and correctly
    // has no window. The second OUTSTANDING pick is the real question.
    expect(getDraftWindow({ ...args, pick_number: 4 })).to.equal(null)
    expect(format(get_draft_pass_window(args))).to.equal('2026-08-18 14:00')
  })

  it('returns the pass window in the lead-up, seeded from the first close', () => {
    expect(
      format(
        get_draft_pass_window({ ...args, until: eastern('2026-08-17 12:00') })
      )
    ).to.equal('2026-08-18 14:00')
  })

  it('returns null when only one pick is outstanding', () => {
    expect(
      get_draft_pass_window({
        ...args,
        draft_picks: board({ total: 2, made: { 1: '2026-08-17 12:00' } })
      })
    ).to.equal(null)
  })
})

describe('LIBS-SHARED get_next_publication_boundary', function () {
  it('is tonight when the band has not closed yet', () => {
    expect(
      format(
        get_next_publication_boundary({
          ...live_2026,
          until: eastern('2026-08-17 12:00')
        })
      )
    ).to.equal('2026-08-18 00:00')
  })

  it('is strictly after a boundary landing exactly on now', () => {
    expect(
      format(
        get_next_publication_boundary({
          ...live_2026,
          until: eastern('2026-08-18 00:00')
        })
      )
    ).to.equal('2026-08-19 00:00')
  })
})

describe('LIBS-SHARED get_draft_window_config', function () {
  const season_row = {
    draft_start: eastern('2026-08-12 00:00').toDate(),
    draft_type: 'hour',
    draft_pick_interval: 3,
    draft_hour_min: 11,
    draft_hour_max: 24,
    rookie_draft_end_at: eastern('2026-08-31 23:59:59').toDate(),
    resumed_at: eastern('2026-08-17 09:00').toDate()
  }

  it('maps the season columns onto the calculator arguments', () => {
    expect(get_draft_window_config(season_row)).to.deep.equal({
      draft_start_timestamp: eastern('2026-08-12 00:00').unix(),
      pick_interval_hours: 3,
      daily_window_start_hour: 11,
      daily_window_end_hour: 24,
      rookie_draft_end_at: season_row.rookie_draft_end_at,
      resumed_at: season_row.resumed_at
    })
  })

  it('normalizes an absent resume to null rather than undefined', () => {
    const { resumed_at } = get_draft_window_config({
      ...season_row,
      resumed_at: undefined
    })
    expect(resumed_at).to.equal(null)
  })

  it('produces the elected 2026 placement when spread into getDraftWindow', () => {
    expect(
      window_for({
        ...get_draft_window_config(season_row),
        draft_picks: board({ total: 10 }),
        pick_number: 1,
        until: eastern('2026-08-18 09:00')
      })
    ).to.equal('2026-08-18 11:00')
  })
})

describe('LIBS-SHARED getDraftDates', function () {
  it('reads the announced hard end rather than projecting one', () => {
    const { draftEnd, waiverEnd } = getDraftDates({
      rookie_draft_end_at: eastern('2026-08-31 23:59:59').toDate()
    })
    expect(format(draftEnd)).to.equal('2026-08-31 23:59')
    expect(format(waiverEnd)).to.equal('2026-09-01 23:59')
  })

  it('short-circuits on an explicit completion timestamp', () => {
    const { draftEnd, waiverEnd } = getDraftDates({
      rookie_draft_end_at: eastern('2026-08-31 23:59:59').toDate(),
      rookie_draft_completed_at: eastern('2026-08-24 16:00').toDate()
    })
    expect(format(draftEnd)).to.equal('2026-08-24 16:00')
    expect(format(waiverEnd)).to.equal('2026-08-25 23:59')
  })

  it('returns nulls for a season with no draft configured', () => {
    expect(getDraftDates({})).to.deep.equal({
      draftEnd: null,
      waiverEnd: null
    })
  })
})
