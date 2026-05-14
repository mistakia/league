/* global describe before after it */

import * as chai from 'chai'
import MockDate from 'mockdate'
import dayjs from 'dayjs'

import { calculateStandings } from '#libs-shared'
import season_dates from '#libs-shared/season-dates.mjs'

const expect = chai.expect

// Pin clock to a date past week 2 so calculateStandings processes exactly
// one week. Season.week is `now.diff(regular_season_start, 'weeks')` (full
// weeks elapsed); 15 days past start = week 2, finalWeek = max(2-1, 0) = 1.
const into_week_2_unix = season_dates.regular_season_start + 15 * 24 * 60 * 60

const make_league = () => ({
  // starter slot counts -- required_starter_count = 7
  sqb: 1,
  srb: 2,
  swr: 2,
  ste: 1,
  srbwr: 0,
  srbwrte: 0,
  sqbrbwrte: 0,
  swrte: 0,
  sdst: 0,
  sk: 1,
  // calculate-points needs at least nominal scoring config; the optimizer only
  // cares about totals, and we provide gamelogs whose `points.total` is set
  // directly via stats.
  pts_per_pass_yd: 0.04,
  pts_per_pass_td: 4,
  pts_per_int: -2,
  pts_per_rush_yd: 0.1,
  pts_per_rush_td: 6,
  pts_per_rec: 0,
  pts_per_rec_yd: 0.1,
  pts_per_rec_td: 6
})

// calculateStandings's playoff-finish step requires 2 or 4 divisions and at
// least 2 teams per division. Use 4 teams across 2 divisions; assertions
// target the detector behavior on team 1 only.
const teams = [
  { uid: 1, div: 1 },
  { uid: 2, div: 1 },
  { uid: 3, div: 2 },
  { uid: 4, div: 2 }
]

// optimizeStandingsLineup post-filters its result keys with player_id_regex
// (4 letters - 4 letters - 4 digits - 4 digits - 2 digits - 2 digits); use
// real-format pids so .starters.length reflects what the LP solver placed.
const letters = (n) =>
  String.fromCharCode(
    ...Array.from({ length: 4 }, (_, k) => 65 + ((n + k) % 26))
  )
const make_pid = (i) =>
  `${letters(i)}-${letters(i + 5)}-2020-1990-01-${String((i % 28) + 1).padStart(2, '0')}`

const make_gamelog = ({
  pid,
  week,
  py = 0,
  ptd = 0,
  ry = 0,
  rtd = 0,
  recy = 0,
  rectd = 0
}) => ({
  pid,
  week,
  py,
  ptd,
  ints: 0,
  ry,
  rtd,
  rec: 0,
  recy,
  rectd,
  // active flag is filtered by the script before passing in; the calc itself
  // does not consult it.
  active: true
})

// Filler full rosters + gamelogs for teams 2-4 so the per-week loop has data
// to iterate and the playoff-finish step has enough teams; only team 1's
// detector behavior is asserted on.
const make_filler_roster = (tid) =>
  [
    { pos: 'QB', i: 0 },
    { pos: 'RB', i: 1 },
    { pos: 'RB', i: 2 },
    { pos: 'WR', i: 3 },
    { pos: 'WR', i: 4 },
    { pos: 'TE', i: 5 },
    { pos: 'K', i: 6 }
  ].map(({ pos, i }) => ({
    pid: make_pid(tid * 10 + i),
    pos
  }))

const make_filler_gamelogs = (tid) =>
  make_filler_roster(tid).map(({ pid, pos }) =>
    make_gamelog({
      pid,
      week: 1,
      py: pos === 'QB' ? 200 : 0,
      ry: ['RB', 'WR'].includes(pos) ? 40 : 0,
      recy: pos === 'TE' ? 30 : 0
    })
  )

const filler_tids = [2, 3, 4]
const filler_starters_by_tid = Object.fromEntries(
  filler_tids.map((tid) => [
    tid,
    make_filler_roster(tid).map((p) => ({ ...p, slot: 1 }))
  ])
)
const filler_active_by_tid = Object.fromEntries(
  filler_tids.map((tid) => [tid, make_filler_roster(tid)])
)
const filler_gamelogs = filler_tids.flatMap(make_filler_gamelogs)

describe('LIBS-SHARED calculate-standings -- incomplete optimal lineup detector', function () {
  before(() => MockDate.set(dayjs.unix(into_week_2_unix).toDate()))
  after(() => MockDate.reset())

  it('full roster fielding 7 starters -> incomplete_optimal_lineup_weeks empty', () => {
    const league = make_league()
    const roster = [
      { pid: make_pid(1), pos: 'QB' },
      { pid: make_pid(2), pos: 'RB' },
      { pid: make_pid(3), pos: 'RB' },
      { pid: make_pid(4), pos: 'WR' },
      { pid: make_pid(5), pos: 'WR' },
      { pid: make_pid(6), pos: 'TE' },
      { pid: make_pid(7), pos: 'K' }
    ]
    const starters = {
      1: {
        1: roster.map((p) => ({ ...p, slot: 1 })),
        ...filler_starters_by_tid
      }
    }
    const active = { 1: { 1: roster, ...filler_active_by_tid } }
    const gamelogs = [
      ...roster.map(({ pid, pos }) =>
        make_gamelog({
          pid,
          week: 1,
          py: pos === 'QB' ? 250 : 0,
          ry: ['RB', 'WR'].includes(pos) ? 50 : 0,
          recy: pos === 'TE' ? 40 : 0
        })
      ),
      ...filler_gamelogs
    ]

    const result = calculateStandings({
      starters,
      active,
      league,
      teams,
      gamelogs,
      matchups: []
    })

    expect(result[1].incomplete_optimal_lineup_weeks).to.be.an.instanceOf(Set)
    expect(result[1].incomplete_optimal_lineup_weeks.has(1)).to.equal(false)
    expect(result[1].incomplete_optimal_lineup_weeks.size).to.equal(0)
  })

  it('roster missing a QB -> week 1 in incomplete_optimal_lineup_weeks', () => {
    const league = make_league()
    const roster = [
      // no QB
      { pid: make_pid(2), pos: 'RB' },
      { pid: make_pid(3), pos: 'RB' },
      { pid: make_pid(4), pos: 'WR' },
      { pid: make_pid(5), pos: 'WR' },
      { pid: make_pid(6), pos: 'TE' },
      { pid: make_pid(7), pos: 'K' }
    ]
    const starters = {
      1: {
        1: roster.map((p) => ({ ...p, slot: 1 })),
        ...filler_starters_by_tid
      }
    }
    const active = { 1: { 1: roster, ...filler_active_by_tid } }
    const gamelogs = [
      ...roster.map(({ pid, pos }) =>
        make_gamelog({ pid, week: 1, ry: 50, recy: 40 })
      ),
      ...filler_gamelogs
    ]

    const result = calculateStandings({
      starters,
      active,
      league,
      teams,
      gamelogs,
      matchups: []
    })

    expect(result[1].incomplete_optimal_lineup_weeks.has(1)).to.equal(true)
  })

  it('all rostered active players inactive (no gamelogs) -> week 1 marked', () => {
    const league = make_league()
    const roster = [
      { pid: make_pid(1), pos: 'QB' },
      { pid: make_pid(2), pos: 'RB' },
      { pid: make_pid(3), pos: 'RB' },
      { pid: make_pid(4), pos: 'WR' },
      { pid: make_pid(5), pos: 'WR' },
      { pid: make_pid(6), pos: 'TE' },
      { pid: make_pid(7), pos: 'K' }
    ]
    const starters = {
      1: {
        1: roster.map((p) => ({ ...p, slot: 1 })),
        ...filler_starters_by_tid
      }
    }
    const active = { 1: { 1: roster, ...filler_active_by_tid } }
    // team 1 has no gamelogs (all players inactive); team 2 still does so the
    // div-finish step has something to sort.
    const gamelogs = [...filler_gamelogs]

    const result = calculateStandings({
      starters,
      active,
      league,
      teams,
      gamelogs,
      matchups: []
    })

    expect(result[1].incomplete_optimal_lineup_weeks.has(1)).to.equal(true)
  })
})
