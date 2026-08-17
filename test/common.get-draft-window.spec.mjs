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
import { get_publication_boundary } from '#libs-shared/get-draft-window.mjs'
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
// 11:00-24:00 Eastern band, so the band closes at midnight and that close is
// the publication boundary. The draft opened Wed Aug 12.
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

describe('LIBS-SHARED get_publication_boundary', function () {
  it('is the band close, which for a 24-hour end is midnight', () => {
    expect(
      format(
        get_publication_boundary({
          ...live_2026,
          until: eastern('2026-08-17 12:00')
        })
      )
    ).to.equal('2026-08-17 00:00')
  })

  it('steps back a day when today has not closed yet', () => {
    expect(
      format(
        get_publication_boundary({
          draft_start_timestamp: live_2026.draft_start_timestamp,
          daily_window_start_hour: 11,
          daily_window_end_hour: 23,
          until: eastern('2026-08-17 12:00')
        })
      )
    ).to.equal('2026-08-16 23:00')
  })

  it('treats draft_start as a boundary before the first daily close', () => {
    expect(
      format(
        get_publication_boundary({
          ...live_2026,
          until: eastern('2026-08-12 14:00')
        })
      )
    ).to.equal('2026-08-12 00:00')
  })

  it('returns null before the draft opens', () => {
    expect(
      get_publication_boundary({
        ...live_2026,
        until: eastern('2026-08-11 23:59')
      })
    ).to.equal(null)
  })

  describe('the resume comparison is >=, to the second', function () {
    it('publishes when the boundary equals the resume exactly', () => {
      expect(
        format(
          get_publication_boundary({
            ...live_2026,
            resumed_at: eastern('2026-08-18 00:00:00').toDate(),
            until: eastern('2026-08-18 09:00')
          })
        )
      ).to.equal('2026-08-18 00:00')
    })

    it('does NOT publish one second after the boundary', () => {
      expect(
        get_publication_boundary({
          ...live_2026,
          resumed_at: eastern('2026-08-18 00:00:01').toDate(),
          until: eastern('2026-08-18 09:00')
        })
      ).to.equal(null)
    })

    it('publishes again at the NEXT boundary after that resume', () => {
      expect(
        format(
          get_publication_boundary({
            ...live_2026,
            resumed_at: eastern('2026-08-18 00:00:01').toDate(),
            until: eastern('2026-08-19 09:00')
          })
        )
      ).to.equal('2026-08-19 00:00')
    })
  })
})

describe('LIBS-SHARED getDraftWindow', function () {
  describe('the anchored walk', function () {
    // The board on the morning of Aug 18 with pick 1 made the previous day, so
    // the whole board is frozen as of the Aug 18 midnight boundary.
    const draft_picks = board({ total: 8, made: { 1: '2026-08-17 12:00' } })
    const args = {
      ...live_2026,
      draft_picks,
      resumed_at: null,
      until: eastern('2026-08-18 09:00')
    }

    it('opens the pick behind a made pick at the day opening hour', () => {
      // Zero steps: nothing unmade sits between pick 1 and pick 2. The anchor
      // is pick 1's selection, clamped forward to the boundary, so the walk
      // starts at the first open hour of the published day.
      expect(format(getDraftWindow({ ...args, pick_number: 2 }))).to.equal(
        '2026-08-18 11:00'
      )
    })

    it('adds one step per unmade pick between the anchor and the pick', () => {
      expect(
        [3, 4, 5, 6].map((pick_number) =>
          format(getDraftWindow({ ...args, pick_number }))
        )
      ).to.deep.equal([
        '2026-08-18 14:00',
        '2026-08-18 17:00',
        '2026-08-18 20:00',
        '2026-08-18 23:00'
      ])
    })

    it('counts only UNMADE picks as steps', () => {
      // Pick 5 measured two ways. With only pick 1 made its anchor is pick 1
      // and picks 2, 3 and 4 are all steps. Make pick 3 as well and the anchor
      // moves to pick 3, leaving only pick 4 as a step — a made pick consumes
      // nothing, whether it anchors or merely sits in between.
      const only_one_made = format(getDraftWindow({ ...args, pick_number: 5 }))

      const three_also_made = board({
        total: 8,
        made: { 1: '2026-08-17 12:00', 3: '2026-08-17 13:00' }
      })
      const with_three = format(
        getDraftWindow({
          ...args,
          draft_picks: three_also_made,
          pick_number: 5
        })
      )

      expect(only_one_made).to.equal('2026-08-18 20:00')
      expect(with_three).to.equal('2026-08-18 14:00')
    })

    it('opens a pick whose own anchor is the pick right before it', () => {
      // Pick 3 is made, so pick 4 sits directly behind a made pick and takes
      // zero steps — the same placement pick 2 gets behind pick 1.
      const three_also_made = board({
        total: 8,
        made: { 1: '2026-08-17 12:00', 3: '2026-08-17 13:00' }
      })
      expect(
        format(
          getDraftWindow({
            ...args,
            draft_picks: three_also_made,
            pick_number: 4
          })
        )
      ).to.equal('2026-08-18 11:00')
    })

    it('returns LITERAL null for a pick already made as of the boundary', () => {
      // Literally null, not undefined: `now.isAfter(undefined)` is TRUE, so a
      // missing return would make every such pick passable.
      expect(getDraftWindow({ ...args, pick_number: 1 })).to.equal(null)
    })

    it('warns and returns null for an invalid pick number', () => {
      expect(getDraftWindow({ ...args, pick_number: 0 })).to.equal(null)
    })
  })

  describe('a gap board, which is the live 2026 shape', function () {
    // Picks 1, 2, 4 and 5 made and 3 the open gap — pick 3 was passed over.
    const made = {
      1: '2026-08-12 05:35',
      2: '2026-08-12 07:56',
      4: '2026-08-12 19:14',
      5: '2026-08-12 19:11'
    }
    const args = {
      ...live_2026,
      draft_picks: board({ total: 12, made }),
      resumed_at: eastern('2026-08-17 09:00').toDate(),
      until: eastern('2026-08-18 09:00')
    }

    it('opens BOTH picks that sit directly behind a made pick together', () => {
      // Pick 3 anchors on pick 2 and pick 6 anchors on pick 5; neither has an
      // unmade pick between it and its anchor, so both take zero steps. They
      // tie, and that is the gap board's defining property — pick 3 has been
      // stalled since Aug 12 and is passable the moment the slate publishes.
      expect(
        [3, 6].map((pick_number) =>
          format(getDraftWindow({ ...args, pick_number }))
        )
      ).to.deep.equal(['2026-08-18 11:00', '2026-08-18 11:00'])
    })

    it('steps the picks behind the gap off their own anchor', () => {
      expect(
        [7, 8, 9].map((pick_number) =>
          format(getDraftWindow({ ...args, pick_number }))
        )
      ).to.deep.equal([
        '2026-08-18 14:00',
        '2026-08-18 17:00',
        '2026-08-18 20:00'
      ])
    })

    it('anchors on the HIGHEST-NUMBERED made pick, not the latest by time', () => {
      // Pick 5 (19:11) was taken BEFORE pick 4 (19:14) on the real board. Move
      // pick 4 later still and pick 6 must not move: its anchor is pick 5
      // either way, and both are clamped to the same boundary.
      const reordered = board({
        total: 12,
        made: { ...made, 4: '2026-08-12 21:00' }
      })
      expect(
        format(
          getDraftWindow({ ...args, draft_picks: reordered, pick_number: 6 })
        )
      ).to.equal('2026-08-18 11:00')
    })

    it('returns null for every pick already made', () => {
      for (const pick_number of [1, 2, 4, 5]) {
        expect(
          getDraftWindow({ ...args, pick_number }),
          `pick ${pick_number}`
        ).to.equal(null)
      }
    })
  })

  describe('the shift is calculated once a day', function () {
    const draft_picks = board({ total: 10, made: { 1: '2026-08-17 12:00' } })
    const base = { ...live_2026, draft_picks, resumed_at: null }

    const slate = (until) =>
      [2, 3, 4, 5].map((pick_number) =>
        format(getDraftWindow({ ...base, until: eastern(until), pick_number }))
      )

    it('holds one slate for the whole day', () => {
      const morning = slate('2026-08-18 00:30')
      expect(morning).to.deep.equal([
        '2026-08-18 11:00',
        '2026-08-18 14:00',
        '2026-08-18 17:00',
        '2026-08-18 20:00'
      ])
      expect(slate('2026-08-18 12:00')).to.deep.equal(morning)
      expect(slate('2026-08-18 23:59')).to.deep.equal(morning)
    })

    it('does not move a window when a pick lands mid-day', () => {
      // Pick 2 is taken at 12:30, after the boundary. It is stripped back to
      // unmade for the day's arithmetic, so nothing behind it moves up until
      // the next publication.
      const after = draft_picks.map((draft_pick) =>
        draft_pick.pick === 2
          ? {
              pick: 2,
              pid: 'PICK-2',
              selection_timestamp: eastern('2026-08-18 12:30').toDate()
            }
          : draft_pick
      )
      const windows = [3, 4, 5].map((pick_number) =>
        format(
          getDraftWindow({
            ...base,
            draft_picks: after,
            until: eastern('2026-08-18 13:00'),
            pick_number
          })
        )
      )
      expect(windows).to.deep.equal([
        '2026-08-18 14:00',
        '2026-08-18 17:00',
        '2026-08-18 20:00'
      ])
    })

    it('moves each window up one step per pick made, at the boundary', () => {
      // Picks 2 and 3 land during Aug 18, so the Aug 19 slate drops two steps
      // off everything behind them.
      const after = draft_picks.map((draft_pick) => {
        if (draft_pick.pick === 2)
          return {
            pick: 2,
            pid: 'PICK-2',
            selection_timestamp: eastern('2026-08-18 12:30').toDate()
          }
        if (draft_pick.pick === 3)
          return {
            pick: 3,
            pid: 'PICK-3',
            selection_timestamp: eastern('2026-08-18 19:00').toDate()
          }
        return draft_pick
      })
      expect(
        [4, 5, 6].map((pick_number) =>
          format(
            getDraftWindow({
              ...base,
              draft_picks: after,
              until: eastern('2026-08-19 00:30'),
              pick_number
            })
          )
        )
      ).to.deep.equal([
        '2026-08-19 11:00',
        '2026-08-19 14:00',
        '2026-08-19 17:00'
      ])
    })

    it('rolls every window forward 24 hours on a day nobody picks', () => {
      // The boundary advanced and no step was consumed, so the whole slate is
      // re-laid a day later. "Windows only ever move up" is false.
      expect(slate('2026-08-19 00:30')).to.deep.equal([
        '2026-08-19 11:00',
        '2026-08-19 14:00',
        '2026-08-19 17:00',
        '2026-08-19 20:00'
      ])
    })
  })

  describe('a step consumes OPEN hours, so the slot times drift', function () {
    // The band is 13 hours and the interval is 3, which does not divide it. The
    // day the slate is published always opens at 11:00, but a pick landing on a
    // later day inherits the hours left over from closing out the previous one.
    it('seats five picks on the published day and drifts the sixth', () => {
      const draft_picks = board({ total: 14 })
      const windows = [1, 2, 3, 4, 5, 6, 7].map((pick_number) =>
        format(
          getDraftWindow({
            ...live_2026,
            draft_picks,
            resumed_at: null,
            until: eastern('2026-08-18 00:30'),
            pick_number
          })
        )
      )
      expect(windows).to.deep.equal([
        '2026-08-18 11:00',
        '2026-08-18 14:00',
        '2026-08-18 17:00',
        '2026-08-18 20:00',
        '2026-08-18 23:00',
        // 23:00 plus three OPEN hours: one closes the day, two open the next.
        '2026-08-19 13:00',
        '2026-08-19 16:00'
      ])
    })

    it('never places a window outside the band', () => {
      const draft_picks = board({ total: 30 })
      for (let pick_number = 1; pick_number <= 30; pick_number++) {
        const window = getDraftWindow({
          ...live_2026,
          draft_picks,
          resumed_at: null,
          until: eastern('2026-08-18 00:30'),
          pick_number
        })
        expect(
          window.tz(DRAFT_TIMEZONE).hour(),
          `pick ${pick_number} landed outside the band`
        ).to.be.within(11, 23)
      }
    })
  })

  describe('a resume voids the standing publication', function () {
    const draft_picks = board({ total: 8, made: { 1: '2026-08-12 12:00' } })
    const resumed_at = eastern('2026-08-17 09:00').toDate()

    it('leaves EVERY pick without a window until the next boundary', () => {
      for (const pick_number of [2, 3, 4, 5, 6, 7, 8]) {
        expect(
          getDraftWindow({
            ...live_2026,
            draft_picks,
            resumed_at,
            until: eastern('2026-08-17 23:59'),
            pick_number
          }),
          `pick ${pick_number}`
        ).to.equal(null)
      }
    })

    it('publishes the first slate at the next boundary', () => {
      expect(
        format(
          getDraftWindow({
            ...live_2026,
            draft_picks,
            resumed_at,
            until: eastern('2026-08-18 00:00'),
            pick_number: 2
          })
        )
      ).to.equal('2026-08-18 11:00')
    })

    it('does not strand the board on a stale anchor after a long pause', () => {
      // The anchor is a selection from Aug 12 and the slate publishes Aug 18.
      // Clamping the anchor to the boundary is what stops every window being
      // days in the past, which would make the whole board passable at once.
      const windows = [2, 3, 4].map((pick_number) =>
        getDraftWindow({
          ...live_2026,
          draft_picks,
          resumed_at,
          until: eastern('2026-08-18 09:00'),
          pick_number
        })
      )
      for (const window of windows) {
        expect(window.isBefore(eastern('2026-08-18 00:00'))).to.equal(false)
      }
    })
  })

  describe('before the draft and with no board', function () {
    it('has no window before the draft opens', () => {
      expect(
        getDraftWindow({
          ...live_2026,
          draft_picks: board({ total: 4 }),
          resumed_at: null,
          until: eastern('2026-08-11 23:00'),
          pick_number: 1
        })
      ).to.equal(null)
    })

    it('treats every pick as unmade, pick N taking N-1 steps', () => {
      const args = {
        ...live_2026,
        resumed_at: null,
        until: eastern('2026-08-12 09:00')
      }
      expect(
        [1, 2, 5, 6].map((pick_number) =>
          format(getDraftWindow({ ...args, pick_number }))
        )
      ).to.deep.equal([
        '2026-08-12 11:00',
        '2026-08-12 14:00',
        '2026-08-12 23:00',
        '2026-08-13 13:00'
      ])
    })
  })

  describe('the constitutional cadence', function () {
    // A full-day band with a 24-hour interval puts one window a day at
    // midnight, which is Article XI Section 8's shape.
    it('opens the pick behind a made pick at the publishing midnight', () => {
      const draft_picks = board({ total: 4, made: { 1: '2026-09-08 23:00' } })
      expect(
        format(
          getDraftWindow({
            ...article_xi_section_8,
            draft_picks,
            resumed_at: null,
            until: eastern('2026-09-09 06:00'),
            pick_number: 2
          })
        )
      ).to.equal('2026-09-09 00:00')
    })

    it('puts consecutive picks exactly 24 hours apart', () => {
      const draft_picks = board({ total: 4, made: { 1: '2026-09-08 23:00' } })
      const windows = [2, 3, 4].map((pick_number) =>
        getDraftWindow({
          ...article_xi_section_8,
          draft_picks,
          resumed_at: null,
          until: eastern('2026-09-09 06:00'),
          pick_number
        })
      )
      expect(windows.map(format)).to.deep.equal([
        '2026-09-09 00:00',
        '2026-09-10 00:00',
        '2026-09-11 00:00'
      ])
      expect(windows[1].diff(windows[0], 'hour')).to.equal(24)
      expect(windows[2].diff(windows[1], 'hour')).to.equal(24)
    })

    it('holds a pick made AFTER the boundary in the queue for the day', () => {
      const draft_picks = board({ total: 4, made: { 1: '2026-09-09 00:30' } })
      expect(
        format(
          getDraftWindow({
            ...article_xi_section_8,
            draft_picks,
            resumed_at: null,
            until: eastern('2026-09-09 06:00'),
            pick_number: 2
          })
        )
      ).to.equal('2026-09-10 00:00')
    })
  })

  describe('wall-clock hours hold across both DST transitions', function () {
    const dst_config = {
      pick_interval_hours: 3,
      daily_window_start_hour: 11,
      daily_window_end_hour: 24
    }

    it('holds the opening hours across the November fall-back', () => {
      const draft_picks = board({ total: 12 })
      const windows = [1, 2, 3, 4, 5].map((pick_number) =>
        getDraftWindow({
          ...dst_config,
          draft_start_timestamp: eastern('2026-10-31 00:00').unix(),
          draft_picks,
          resumed_at: null,
          until: eastern('2026-11-01 00:30'),
          pick_number
        })
      )
      expect(windows.map(format)).to.deep.equal([
        '2026-11-01 11:00',
        '2026-11-01 14:00',
        '2026-11-01 17:00',
        '2026-11-01 20:00',
        '2026-11-01 23:00'
      ])
      // And the offset really did change under them.
      expect(windows[0].utcOffset()).to.equal(-300)
    })

    it('holds the opening hours across the March spring-forward', () => {
      const draft_picks = board({ total: 12 })
      expect(
        [1, 2, 3, 4, 5].map((pick_number) =>
          format(
            getDraftWindow({
              ...dst_config,
              draft_start_timestamp: eastern('2027-03-13 00:00').unix(),
              draft_picks,
              resumed_at: null,
              until: eastern('2027-03-14 00:30'),
              pick_number
            })
          )
        )
      ).to.deep.equal([
        '2027-03-14 11:00',
        '2027-03-14 14:00',
        '2027-03-14 17:00',
        '2027-03-14 20:00',
        '2027-03-14 23:00'
      ])
    })
  })

  describe('the live 2026 board reaches the hard end', function () {
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

    it('places the last pick inside the announced Aug 31 cutoff', () => {
      // The LATEST the board can reach pick 65, since every publication can
      // only shorten the queue. Not a forecast of when it will.
      const last = getDraftWindow({ ...args, pick_number: 65 })
      expect(format(last)).to.equal('2026-08-31 19:00')
      expect(last.isBefore(eastern('2026-08-31 23:59'))).to.equal(true)
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
    expect(format(get_draft_pass_window(args))).to.equal('2026-08-18 11:00')
  })

  it('returns null when no slate is published', () => {
    expect(
      get_draft_pass_window({ ...args, until: eastern('2026-08-17 12:00') })
    ).to.equal(null)
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
      format(
        getDraftWindow({
          ...get_draft_window_config(season_row),
          draft_picks: board({ total: 10 }),
          pick_number: 1,
          until: eastern('2026-08-18 09:00')
        })
      )
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
