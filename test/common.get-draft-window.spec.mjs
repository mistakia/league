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
import {
  get_draft_slot_hours,
  get_publication_boundary,
  get_draft_slot_at_index
} from '#libs-shared/get-draft-window.mjs'
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

// The settings elected for the 2026 rookie draft
// (db/adhoc/2026-08-16-draft-window-slate.sql): a 3-hour interval on an
// 11:00-24:00 Eastern band, so slots at 11, 14, 17, 20 and 23 and a publication
// boundary on midnight. The draft opened Wed Aug 12.
const live_2026 = {
  draft_start_timestamp: eastern('2026-08-12 00:00').unix(),
  pick_interval_hours: 3,
  daily_window_start_hour: 11,
  daily_window_end_hour: 24
}

// The constitutional cadence: a full-day band with a 24-hour interval, which
// derives exactly one slot a day, at midnight.
const article_xi_section_8 = {
  draft_start_timestamp: eastern('2026-09-01 00:00').unix(),
  pick_interval_hours: 24,
  daily_window_start_hour: 0,
  daily_window_end_hour: 24
}

// A board of `total` picks, unmade except for the entries in `made`, which maps
// a pick number to its selection instant. The calculator takes the WHOLE board
// because a pick's index is its position in the outstanding set.
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

describe('LIBS-SHARED get_draft_slot_hours', function () {
  it('derives the elected 2026 slots from the band and the interval', () => {
    expect(get_draft_slot_hours(live_2026)).to.deep.equal([11, 14, 17, 20, 23])
  })

  it('stops strictly inside the band', () => {
    // 11 + 4 + 4 = 19 is the last hour strictly below 23.
    expect(
      get_draft_slot_hours({
        pick_interval_hours: 4,
        daily_window_start_hour: 11,
        daily_window_end_hour: 23
      })
    ).to.deep.equal([11, 15, 19])
  })

  it('derives ONE midnight slot for the constitutional cadence', () => {
    expect(get_draft_slot_hours(article_xi_section_8)).to.deep.equal([0])
  })

  it('leaves the opening hour when the interval exceeds the band', () => {
    expect(
      get_draft_slot_hours({
        pick_interval_hours: 12,
        daily_window_start_hour: 11,
        daily_window_end_hour: 16
      })
    ).to.deep.equal([11])
  })
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
    // A 23:00 band close, so at 12:00 the latest close is yesterday's.
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
    // A boundary landing exactly ON the resume publishes. Under a strict `>` a
    // one-second coincidence blacks out a further whole day.
    const boundary_instant = '2026-08-18 00:00:00'

    it('publishes when the boundary equals the resume exactly', () => {
      expect(
        format(
          get_publication_boundary({
            ...live_2026,
            resumed_at: eastern(boundary_instant).toDate(),
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

describe('LIBS-SHARED get_draft_slot_at_index', function () {
  const slot_hours = get_draft_slot_hours(live_2026)

  it('lays the outstanding picks onto the slots following a boundary', () => {
    const from = eastern('2026-08-18 00:00')
    const laid = [0, 1, 2, 3, 4, 5, 6].map((index) =>
      format(get_draft_slot_at_index({ from, index, slot_hours }))
    )
    expect(laid).to.deep.equal([
      '2026-08-18 11:00',
      '2026-08-18 14:00',
      '2026-08-18 17:00',
      '2026-08-18 20:00',
      '2026-08-18 23:00',
      '2026-08-19 11:00',
      '2026-08-19 14:00'
    ])
  })

  it('takes a slot AT the anchor, never the next one', () => {
    // The whole reason this is at-or-after: under a full-day band the boundary
    // and the day's only slot are the same instant, so the strict reading
    // republishes the head pick a day further out every day and no window ever
    // opens for anybody.
    const from = eastern('2026-09-10 00:00')
    expect(
      format(
        get_draft_slot_at_index({
          from,
          index: 0,
          slot_hours: get_draft_slot_hours(article_xi_section_8)
        })
      )
    ).to.equal('2026-09-10 00:00')
  })

  it('skips a slot the anchor has already passed', () => {
    expect(
      format(
        get_draft_slot_at_index({
          from: eastern('2026-08-18 15:30'),
          index: 0,
          slot_hours
        })
      )
    ).to.equal('2026-08-18 17:00')
  })
})

describe('LIBS-SHARED getDraftWindow', function () {
  describe('publication', function () {
    // The board on the morning of Aug 18, with picks 1, 2, 4 and 5 made and 3
    // the open gap — the shape of the live 2026 board. Every selection is on
    // Aug 12, so all four are made as of every boundary since.
    const made = {
      1: '2026-08-12 05:35',
      2: '2026-08-12 07:56',
      4: '2026-08-12 19:14',
      5: '2026-08-12 19:11'
    }
    const draft_picks = board({ total: 12, made })
    const args = {
      ...live_2026,
      draft_picks,
      resumed_at: eastern('2026-08-17 09:00').toDate(),
      until: eastern('2026-08-18 09:00')
    }

    it('lays the outstanding picks onto the day in pick order', () => {
      const windows = [3, 6, 7, 8, 9, 10].map((pick_number) =>
        format(getDraftWindow({ ...args, pick_number }))
      )
      expect(windows).to.deep.equal([
        '2026-08-18 11:00',
        '2026-08-18 14:00',
        '2026-08-18 17:00',
        '2026-08-18 20:00',
        '2026-08-18 23:00',
        '2026-08-19 11:00'
      ])
    })

    it('returns LITERAL null for a pick already made', () => {
      // Literally null, not undefined: `now.isAfter(undefined)` is TRUE, so a
      // missing return would make every such pick passable.
      for (const pick_number of [1, 2, 4, 5]) {
        expect(
          getDraftWindow({ ...args, pick_number }),
          `pick ${pick_number}`
        ).to.equal(null)
      }
    })

    it('returns LITERAL null for a pick beyond the board', () => {
      expect(getDraftWindow({ ...args, pick_number: 13 })).to.equal(null)
    })

    it('spills onto the following days once a day is exhausted', () => {
      expect(format(getDraftWindow({ ...args, pick_number: 12 }))).to.equal(
        '2026-08-19 17:00'
      )
    })
  })

  describe('the freeze between boundaries', function () {
    // The outstanding set is computed as of the BOUNDARY, not as of now. A pick
    // made after the boundary keeps its index, so no later pick's published
    // slot moves until the next publication.
    const boundary_board = board({
      total: 8,
      made: { 1: '2026-08-17 12:00' }
    })
    const base = {
      ...live_2026,
      resumed_at: null,
      until: eastern('2026-08-18 12:00')
    }

    const published = (draft_picks, until) =>
      [2, 3, 4, 5].map((pick_number) =>
        format(getDraftWindow({ ...base, draft_picks, until, pick_number }))
      )

    it('holds every later pick still when a pick lands after the boundary', () => {
      const before = published(boundary_board, eastern('2026-08-18 12:00'))

      // Pick 2 is taken at 12:30, after the midnight boundary.
      const after_board = boundary_board.map((draft_pick) =>
        draft_pick.pick === 2
          ? {
              pick: 2,
              pid: 'PICK-2',
              selection_timestamp: eastern('2026-08-18 12:30').toDate()
            }
          : draft_pick
      )
      const after = published(after_board, eastern('2026-08-18 13:00'))

      expect(before).to.deep.equal([
        '2026-08-18 11:00',
        '2026-08-18 14:00',
        '2026-08-18 17:00',
        '2026-08-18 20:00'
      ])

      // Pick 2 keeps its slot: it is still in the frozen outstanding set, so
      // picks 4 and 5 do not move UP to fill the space it vacated.
      expect(after[0]).to.equal('2026-08-18 11:00')
      expect(after[2]).to.equal('2026-08-18 17:00')
      expect(after[3]).to.equal('2026-08-18 20:00')

      // Pick 3 does not move either. The slate takes no selection time as an
      // input, so the pick behind a just-made pick keeps the slot it was
      // published in — the whole board is frozen, not merely held against
      // moving up.
      expect(after[1]).to.equal('2026-08-18 14:00')
      expect(after).to.deep.equal(before)
    })

    it('every window IS its published slot, exactly', () => {
      // Sweep the day: a pick's window is the (index)-th slot after the
      // governing boundary and nothing else, so there is no term that can
      // move it off that slot in either direction.
      const draft_picks = boundary_board
      for (const pick_number of [2, 3, 4, 5, 6, 7, 8]) {
        const window = getDraftWindow({
          ...base,
          draft_picks,
          pick_number
        })
        const slot = get_draft_slot_at_index({
          from: eastern('2026-08-18 00:00'),
          index: pick_number - 2,
          slot_hours: get_draft_slot_hours(live_2026)
        })
        expect(
          format(window),
          `pick ${pick_number} is not its published slot`
        ).to.equal(format(slot))
      }
    })

    it('DOES move a window earlier ACROSS a boundary', () => {
      // The other half of the invariant, and the one the notice announces: at a
      // boundary the picks made since the last publication shrink every later
      // pick's index, so the slate moves up. Once a day, knowable the night
      // before.
      const draft_picks = boundary_board.map((draft_pick) =>
        draft_pick.pick === 2
          ? {
              pick: 2,
              pid: 'PICK-2',
              selection_timestamp: eastern('2026-08-18 12:30').toDate()
            }
          : draft_pick
      )

      const before_boundary = format(
        getDraftWindow({
          ...base,
          draft_picks,
          pick_number: 5,
          until: eastern('2026-08-18 23:59')
        })
      )
      const after_boundary = format(
        getDraftWindow({
          ...base,
          draft_picks,
          pick_number: 5,
          until: eastern('2026-08-19 00:01')
        })
      )

      expect(before_boundary).to.equal('2026-08-18 20:00')
      // Pick 2 has left the outstanding set, so pick 5 takes the third slot of
      // the new day rather than the fourth of the old one.
      expect(after_boundary).to.equal('2026-08-19 17:00')
    })
  })

  describe('the slate takes no selection time as an input', function () {
    // The rule the operator elected: window(P) is P's published slot and
    // nothing else. A pick's actual selection instant is irrelevant to every
    // window on the board, so a slow board does not push anything back and a
    // fast one does not pull anything forward until the next publication.
    const args = {
      ...live_2026,
      resumed_at: null,
      until: eastern('2026-08-18 20:05')
    }

    it('leaves the picks behind a LATE selection on their published slots', () => {
      // The midnight boundary published picks 1-4 at 11:00, 14:00, 17:00 and
      // 20:00. Pick 1 is not finally made until 20:00 — nine hours after its
      // own slot — and that lateness moves nothing: picks 2, 3 and 4 sit where
      // the slate put them the night before.
      const draft_picks = board({
        total: 6,
        made: { 1: '2026-08-18 20:00' }
      })
      expect(
        [2, 3, 4].map((pick_number) =>
          format(getDraftWindow({ ...args, draft_picks, pick_number }))
        )
      ).to.deep.equal([
        '2026-08-18 14:00',
        '2026-08-18 17:00',
        '2026-08-18 20:00'
      ])
    })

    it('gives the same windows for wildly different selection times', () => {
      // The same board, made at 11:05 and at 23:30 — the two extremes of the
      // day. Every outstanding pick's window is identical, which is the rule
      // stated as a property rather than as a table of slots.
      const windows_for = (selected_at) => {
        const draft_picks = board({ total: 6, made: { 1: selected_at } })
        return [2, 3, 4, 5, 6].map((pick_number) =>
          format(
            getDraftWindow({
              ...args,
              draft_picks,
              until: eastern('2026-08-18 23:45'),
              pick_number
            })
          )
        )
      }

      expect(windows_for('2026-08-18 23:30')).to.deep.equal(
        windows_for('2026-08-18 11:05')
      )
    })

    it('holds a late selection off the following morning entirely', () => {
      // A 23:00 selection is the case the removed floor moved to 11:00 the
      // next day, because 23:00 plus the three-hour interval falls outside the
      // band. The slate publishes pick 2 at 14:00 and it stays there.
      const late = board({ total: 6, made: { 1: '2026-08-18 23:00' } })
      expect(
        format(
          getDraftWindow({
            ...args,
            draft_picks: late,
            until: eastern('2026-08-18 23:05'),
            pick_number: 2
          })
        )
      ).to.equal('2026-08-18 14:00')
    })

    it('is unmoved by a gap board whose picks land out of order', () => {
      // Picks 4 and 5 land in the reverse of pick order, which is the live
      // 2026 board's shape. Under an anchored rule the order of those two
      // decides pick 6's window; under the slate neither is read at all.
      const gap = board({
        total: 8,
        made: {
          1: '2026-08-17 12:00',
          2: '2026-08-17 13:00',
          3: '2026-08-17 14:00',
          4: '2026-08-18 19:14',
          5: '2026-08-18 19:11'
        }
      })
      const gap_args = {
        ...args,
        draft_picks: gap,
        until: eastern('2026-08-18 21:05'),
        pick_number: 6
      }
      // Picks 1-3 were made before the boundary, so the outstanding set is
      // 4, 5, 6, 7, 8 and pick 6 takes the third slot: 17:00.
      expect(format(getDraftWindow(gap_args))).to.equal('2026-08-18 17:00')

      const reordered = gap.map((draft_pick) =>
        draft_pick.pick === 4
          ? {
              ...draft_pick,
              selection_timestamp: eastern('2026-08-18 21:00').toDate()
            }
          : draft_pick
      )
      expect(
        format(getDraftWindow({ ...gap_args, draft_picks: reordered }))
      ).to.equal('2026-08-18 17:00')
    })

    it('places pick 1 on the first slot of the opening publication', () => {
      expect(
        format(
          getDraftWindow({
            ...live_2026,
            draft_picks: board({ total: 6 }),
            resumed_at: null,
            until: eastern('2026-08-12 09:00'),
            pick_number: 1
          })
        )
      ).to.equal('2026-08-12 11:00')
    })
  })

  describe('the once-per-day republication', function () {
    // The boundary re-lays the picks still unmade onto the slots from THAT
    // midnight forward. So a window's absolute movement is the net of two
    // things: the boundary advancing a full day, and the pick's index shrinking
    // by however many picks were made. It moves EARLIER only when the day
    // consumed more than a day's worth of slots, and otherwise moves later —
    // "windows only ever move up" is false and the cases below pin both
    // directions.
    const draft_picks = board({
      total: 8,
      made: {
        1: '2026-08-17 12:00',
        2: '2026-08-18 11:30',
        3: '2026-08-18 19:00'
      }
    })
    const base = { ...live_2026, draft_picks, resumed_at: null }

    const slate = (until) =>
      [4, 5, 6, 7, 8].map((pick_number) =>
        format(getDraftWindow({ ...base, until: eastern(until), pick_number }))
      )

    it('holds one slate for the whole day, however many picks land', () => {
      // Three readings spanning the day, with picks 2 and 3 landing between the
      // first and the last. Nothing moves.
      const morning = slate('2026-08-18 00:30')
      const midday = slate('2026-08-18 12:00')
      const evening = slate('2026-08-18 23:59')

      // Picks 2 and 3 were still outstanding at the Aug 18 boundary, so they
      // hold indices 0 and 1 all day and pick 4 starts at the third slot.
      expect(morning).to.deep.equal([
        '2026-08-18 17:00',
        '2026-08-18 20:00',
        '2026-08-18 23:00',
        '2026-08-19 11:00',
        '2026-08-19 14:00'
      ])
      expect(midday).to.deep.equal(morning)
      expect(evening).to.deep.equal(morning)
    })

    it('re-lays the outstanding picks from the new midnight', () => {
      // Picks 2 and 3 were made during Aug 18, so pick 4 heads the Aug 19
      // slate and takes its first slot. Note this is LATER in absolute time
      // than the Aug 18 17:00 it held during the day: two picks freed two
      // slots, and the boundary advanced five.
      expect(slate('2026-08-19 00:00')).to.deep.equal([
        '2026-08-19 11:00',
        '2026-08-19 14:00',
        '2026-08-19 17:00',
        '2026-08-19 20:00',
        '2026-08-19 23:00'
      ])
    })

    it('rolls a window a full day LATER when nobody picks', () => {
      // The plain case, and the one that shows the boundary is not a ratchet.
      // Nothing is made on Aug 19, so Aug 20 republishes the identical
      // outstanding set onto its own day and every window moves back 24 hours.
      expect(slate('2026-08-20 00:00')).to.deep.equal([
        '2026-08-20 11:00',
        '2026-08-20 14:00',
        '2026-08-20 17:00',
        '2026-08-20 20:00',
        '2026-08-20 23:00'
      ])
    })

    it('moves a window EARLIER only past a full day of slots', () => {
      // Six picks in one day against five slots, so pick 8's index falls
      // further than the boundary advances and its window genuinely moves up.
      const fast = board({
        total: 12,
        made: {
          1: '2026-08-18 11:05',
          2: '2026-08-18 11:10',
          3: '2026-08-18 11:15',
          4: '2026-08-18 11:20',
          5: '2026-08-18 11:25',
          6: '2026-08-18 11:30'
        }
      })
      const window_at = (until) =>
        format(
          getDraftWindow({
            ...live_2026,
            draft_picks: fast,
            resumed_at: null,
            until: eastern(until),
            pick_number: 8
          })
        )

      expect(window_at('2026-08-18 23:59')).to.equal('2026-08-19 17:00')
      expect(window_at('2026-08-19 00:30')).to.equal('2026-08-19 14:00')
    })
  })

  describe('the constitutional cadence publishes one slot a day', function () {
    // A full-day band with a 24-hour interval derives exactly one slot, at
    // midnight, which is the Article XI Section 8 cadence. Under the slate a
    // pick's window is its published midnight and the selection instant that
    // preceded it is not read at all, so the answer depends only on which picks
    // were outstanding at the governing boundary.
    const cases = [
      {
        // Made BEFORE the boundary, so pick 2 heads the outstanding set and
        // takes the boundary's own midnight.
        previous: '2026-09-08 23:00',
        until: '2026-09-09 06:00',
        published: '2026-09-09 00:00'
      },
      {
        // Made AFTER the boundary, so pick 1 is still in the set and pick 2
        // takes the following midnight.
        previous: '2026-09-09 00:30',
        until: '2026-09-09 06:00',
        published: '2026-09-10 00:00'
      },
      {
        previous: '2026-09-09 14:00',
        until: '2026-09-09 18:00',
        published: '2026-09-10 00:00'
      },
      {
        previous: '2026-09-09 23:58',
        until: '2026-09-09 23:59',
        published: '2026-09-10 00:00'
      }
    ]

    for (const { previous, until, published } of cases) {
      it(`a selection at ${previous} publishes pick 2 at ${published}`, () => {
        const draft_picks = board({ total: 4, made: { 1: previous } })
        const window = getDraftWindow({
          ...article_xi_section_8,
          draft_picks,
          resumed_at: null,
          until: eastern(until),
          pick_number: 2
        })

        expect(format(window)).to.equal(published)
      })
    }

    it('is frozen across the day like every other cadence', () => {
      const draft_picks = board({ total: 4, made: { 1: '2026-09-09 00:30' } })
      const window_at = (until) =>
        format(
          getDraftWindow({
            ...article_xi_section_8,
            draft_picks,
            resumed_at: null,
            until: eastern(until),
            pick_number: 2
          })
        )

      expect(window_at('2026-09-09 23:59')).to.equal(
        window_at('2026-09-09 00:01')
      )
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
  })

  describe('the pre-publication gap', function () {
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
  })

  describe('with no board at all', function () {
    it('treats every pick as outstanding, pick N taking the (N-1)th slot', () => {
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
        '2026-08-13 11:00'
      ])
    })

    it('warns and returns null for an invalid pick number', () => {
      expect(
        getDraftWindow({
          ...live_2026,
          until: eastern('2026-08-12 09:00'),
          pick_number: 0
        })
      ).to.equal(null)
    })
  })

  describe('every window lands inside the band', function () {
    // This is what makes the removed `is_within_daily_window` gate provably
    // unable to change an answer: no window is constructible outside the band,
    // so a second check on the band is inert.
    it('sweeps a published day and finds no window outside 11:00-24:00', () => {
      const draft_picks = board({ total: 30 })
      for (let pick_number = 1; pick_number <= 30; pick_number++) {
        const window = getDraftWindow({
          ...live_2026,
          draft_picks,
          resumed_at: null,
          until: eastern('2026-08-18 00:30'),
          pick_number
        })
        const hour = window.tz(DRAFT_TIMEZONE).hour()
        expect(
          [11, 14, 17, 20, 23],
          `pick ${pick_number} landed on hour ${hour}`
        ).to.include(hour)
      }
    })
  })

  describe('wall-clock hours hold across both DST transitions', function () {
    // Every slot is built fresh from its (date, hour) pair rather than by
    // adding hours to the previous one, so the offset change does not walk the
    // schedule off the hours the notice publishes.
    const dst_config = {
      pick_interval_hours: 3,
      daily_window_start_hour: 11,
      daily_window_end_hour: 24
    }

    it('holds 11/14/17/20/23 across the November fall-back', () => {
      // 2026-11-01 is the fall-back date; the band spans it.
      const draft_picks = board({ total: 12 })
      const windows = [1, 2, 3, 4, 5, 6].map((pick_number) =>
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
        '2026-11-01 23:00',
        '2026-11-02 11:00'
      ])
      // And the offset really did change under them.
      expect(windows[0].utcOffset()).to.equal(-300)
      expect(
        getDraftWindow({
          ...dst_config,
          draft_start_timestamp: eastern('2026-10-30 00:00').unix(),
          draft_picks,
          resumed_at: null,
          until: eastern('2026-10-31 00:30'),
          pick_number: 1
        }).utcOffset()
      ).to.equal(-240)
    })

    it('holds 11/14/17/20/23 across the March spring-forward', () => {
      // 2027-03-14 is the spring-forward date. No elected slot hour is 02:00,
      // so nothing here is the residual tracked on the DST task.
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

    it('publishes a boundary at midnight on both transition dates', () => {
      expect(
        format(
          get_publication_boundary({
            ...dst_config,
            draft_start_timestamp: eastern('2026-10-01 00:00').unix(),
            until: eastern('2026-11-01 12:00')
          })
        )
      ).to.equal('2026-11-01 00:00')
      expect(
        format(
          get_publication_boundary({
            ...dst_config,
            draft_start_timestamp: eastern('2027-03-01 00:00').unix(),
            until: eastern('2027-03-14 12:00')
          })
        )
      ).to.equal('2027-03-14 00:00')
    })
  })

  describe('the live 2026 board', function () {
    // 65 picks, four made (1, 2, 4 and 5) with 3 the open gap, resumed on the
    // morning of Aug 17 so the first slate publishes at midnight on Aug 18.
    const made = {
      1: '2026-08-12 05:35',
      2: '2026-08-12 07:56',
      4: '2026-08-12 19:14',
      5: '2026-08-12 19:11'
    }
    const draft_picks = board({ total: 65, made })
    const args = {
      ...live_2026,
      draft_picks,
      resumed_at: eastern('2026-08-17 09:00').toDate(),
      until: eastern('2026-08-18 09:00')
    }

    it('opens the first slate at 11:00 on the pick that is on the clock', () => {
      expect(format(getDraftWindow({ ...args, pick_number: 3 }))).to.equal(
        '2026-08-18 11:00'
      )
    })

    it('places the 61st outstanding pick inside the hard end', () => {
      // Five slots a day from Aug 18 puts the last pick at Aug 30 11:00,
      // ahead of the announced Aug 31 23:59 hard end. Every midnight
      // republication can only move it earlier, so this is the LATEST the
      // board can reach its last pick, not a forecast of when it will.
      expect(format(getDraftWindow({ ...args, pick_number: 65 }))).to.equal(
        '2026-08-30 11:00'
      )
    })
  })
})

describe('LIBS-SHARED get_draft_pass_window', function () {
  // Both former call sites asked for `frontier.pick + 1`, which on a board with
  // a gap names a pick that is already MADE — on the live board the frontier is
  // pick 3 and pick 4 is made — for which the calculator correctly returns
  // null. Asking for the SECOND outstanding pick asks the real question.
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

  it('returns the slot of the second outstanding pick, not of frontier + 1', () => {
    // The frontier is pick 3; `frontier.pick + 1` is pick 4, which is made.
    expect(getDraftWindow({ ...args, pick_number: 4 })).to.equal(null)
    expect(format(get_draft_pass_window(args))).to.equal('2026-08-18 14:00')
  })

  it('returns a real instant for a board whose last pick is beyond the end', () => {
    // The SPA's other former call site passed `last_pick.pick + 1` = 66.
    expect(getDraftWindow({ ...args, pick_number: 66 })).to.equal(null)
    expect(get_draft_pass_window(args)).to.not.equal(null)
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
        draft_picks: board({
          total: 2,
          made: { 1: '2026-08-17 12:00' }
        })
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
  // The season row carries a Date; this mapper is the boundary that turns it
  // back into the epoch seconds the calculator does arithmetic on.
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

  it('does NOT map draft_type — the calculator takes hours unconditionally', () => {
    expect(get_draft_window_config(season_row)).to.not.have.property(
      'cadence_unit'
    )
  })

  it('normalizes an absent resume to null rather than undefined', () => {
    const { resumed_at } = get_draft_window_config({
      ...season_row,
      resumed_at: undefined
    })
    expect(resumed_at).to.equal(null)
  })

  it('produces the elected 2026 slate when spread into getDraftWindow', () => {
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
