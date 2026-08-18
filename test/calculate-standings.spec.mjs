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
  // playoff format -- calculateStandings reads these off the league/season row
  playoff_team_count: 6,
  bye_count: 2,
  has_division_winner_berths: false,
  // starter slot counts -- required_starter_count = 7
  starter_slots_quarterback: 1,
  starter_slots_running_back: 2,
  starter_slots_wide_receiver: 2,
  starter_slots_tight_end: 1,
  starter_slots_running_back_wide_receiver_flex: 0,
  starter_slots_running_back_wide_receiver_tight_end_flex: 0,
  starter_slots_superflex: 0,
  starter_slots_wide_receiver_tight_end_flex: 0,
  starter_slots_defense_special_teams: 0,
  starter_slots_kicker: 1,
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

// calculateStandings seeds on head-to-head record regardless of division
// count, so any division layout works here. Assertions target the detector
// behavior on team 1 only.
const teams = [
  { team_id: 1, division: 1 },
  { team_id: 2, division: 1 },
  { team_id: 3, division: 2 },
  { team_id: 4, division: 2 }
]

// optimizeStandingsLineup post-filters its result keys with player_id_regex,
// which is /^[A-Z]{4}-[A-Z]{4}-[0-9]{6}$/i -- four letters, four letters, then
// a six-digit DDMMYY. Use real-format pids so .starters.length reflects what
// the LP solver placed; a pid that does not match is dropped from the result
// and the week reads as an incomplete lineup.
const letters = (n) =>
  String.fromCharCode(
    ...Array.from({ length: 4 }, (_, k) => 65 + ((n + k) % 26))
  )
const make_pid = (i) =>
  `${letters(i)}-${letters(i + 5)}-${String((i % 28) + 1).padStart(2, '0')}0190`

const make_gamelog = ({
  pid,
  week,
  passing_yards = 0,
  passing_touchdowns = 0,
  rushing_yards = 0,
  rushing_touchdowns = 0,
  receiving_yards = 0,
  receiving_touchdowns = 0
}) => ({
  pid,
  week,
  passing_yards,
  passing_touchdowns,
  passing_interceptions: 0,
  rushing_yards,
  rushing_touchdowns,
  receptions: 0,
  receiving_yards,
  receiving_touchdowns,
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
      passing_yards: pos === 'QB' ? 200 : 0,
      rushing_yards: ['RB', 'WR'].includes(pos) ? 40 : 0,
      receiving_yards: pos === 'TE' ? 30 : 0
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
          passing_yards: pos === 'QB' ? 250 : 0,
          rushing_yards: ['RB', 'WR'].includes(pos) ? 50 : 0,
          receiving_yards: pos === 'TE' ? 40 : 0
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
        make_gamelog({ pid, week: 1, rushing_yards: 50, receiving_yards: 40 })
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
