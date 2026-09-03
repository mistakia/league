/* global describe it */
import * as chai from 'chai'

import { roster_slot_types } from '#constants'
import { Roster, get_auction_team_capacity } from '#libs-shared'

process.env.NODE_ENV = 'test'
const expect = chai.expect

// The eligible-set predicate, driven directly. It decides two different things
// in two different tiers -- who the auction is still waiting on at settlement,
// and whether the bid bar offers a manager a bid, a decline or a maximum at all
// -- and the reason it is one function is that those two answers must never
// disagree. So this spec asserts the TERMS individually, not just the boolean:
// the bar picks its wording from which term failed, and a predicate that got
// the conjunction right while reporting the wrong cause would put "Exceeded
// CAP" on a manager whose roster is full.
//
// Everything here is pure. The server's `get_team_auction_capacity` adds a
// roster read and nothing else, and the socket, the settlement paths and the
// bid bar all arrive at this function with a `Roster` already built.

const build_league = (overrides = {}) => ({
  starter_slots_quarterback: 1,
  starter_slots_running_back: 1,
  starter_slots_wide_receiver: 1,
  starter_slots_tight_end: 0,
  starter_slots_running_back_wide_receiver_flex: 0,
  starter_slots_running_back_wide_receiver_tight_end_flex: 0,
  starter_slots_superflex: 0,
  starter_slots_wide_receiver_tight_end_flex: 0,
  starter_slots_defense_special_teams: 0,
  starter_slots_kicker: 0,
  bench_slot_count: 1,
  practice_squad_slot_count: 0,
  reserve_short_term_limit: 0,
  salary_cap: 200,
  // PINNED IN THE PAST, and the fixture is date-dependent without it. `Roster`
  // prices every row through `getExtensionAmount` while a league is inside its
  // extension window, and a league with no `extension_deadline_at` is treated
  // as inside it for the whole offseason -- so a fixture that omits the field
  // gets `NaN` salaries from August to February and correct ones in September,
  // which is a spec that passes or fails on the day it is run.
  extension_deadline_at: '2020-01-01',
  max_roster_quarterback: 0,
  max_roster_running_back: 2,
  max_roster_wide_receiver: 0,
  max_roster_tight_end: 0,
  max_roster_kicker: 0,
  max_roster_defense_special_teams: 0,
  ...overrides
})

// Active players, so they count against both the roster limit and the cap.
const build_roster = (players) => ({
  roster_id: 1,
  players: players.map((player, index) => ({
    slot: roster_slot_types.BENCH,
    pid: `PLAY-ER${index}-000001`,
    ...player
  }))
})

const capacity_for = ({ league_overrides, players = [], current_price = 0 }) =>
  get_auction_team_capacity({
    roster: new Roster({
      roster: build_roster(players),
      league: build_league(league_overrides)
    }),
    player_position: 'RB',
    current_price
  })

describe('LIBS-SHARED auction team capacity', function () {
  it('is eligible with a spot, room at the position and cap over the price', () => {
    const capacity = capacity_for({ current_price: 5 })

    expect(capacity.is_eligible).to.equal(true)
    expect(capacity.has_roster_space).to.equal(true)
    expect(capacity.has_position_capacity).to.equal(true)
    expect(capacity.has_cap_space).to.equal(true)
    expect(capacity.is_eligible_for_slot).to.equal(true)
  })

  it('reports a full roster as the roster-space term', () => {
    // Four slots in the fixture -- three starters and one bench.
    const capacity = capacity_for({
      players: [
        { pos: 'QB', player_salary: 1 },
        { pos: 'RB', player_salary: 1 },
        { pos: 'WR', player_salary: 1 },
        { pos: 'TE', player_salary: 1 }
      ],
      current_price: 5
    })

    expect(capacity.available_space).to.equal(0)
    expect(capacity.has_roster_space).to.equal(false)
    expect(capacity.is_eligible_for_slot).to.equal(false)
    expect(capacity.is_eligible).to.equal(false)
  })

  // THE DISCRIMINATING CASE, and the one a single boolean cannot express: a
  // team with an open spot and money to spend that still cannot take this
  // player, because it already holds the position limit. Reported as
  // `Roster Full` or `Exceeded CAP` it sends a manager looking for a remedy
  // that does not exist.
  it('reports a position limit with roster space still open', () => {
    const capacity = capacity_for({
      league_overrides: { max_roster_running_back: 1 },
      players: [{ pos: 'RB', player_salary: 1 }],
      current_price: 5
    })

    expect(capacity.has_roster_space).to.equal(true)
    expect(capacity.has_position_capacity).to.equal(false)
    expect(capacity.is_eligible_for_slot).to.equal(false)
    expect(capacity.is_eligible).to.equal(false)
  })

  // `>=`, not `>`. A team holding exactly the price on the board is still in
  // the eligible set -- it can match, and matching wins under the nomination
  // tiebreak. The pair is the point: one dollar either side of the price has to
  // give two different answers, or the comparison is untested whichever way it
  // is written.
  it('keeps a team whose cap exactly equals the price', () => {
    const capacity = capacity_for({
      league_overrides: { salary_cap: 10 },
      players: [{ pos: 'QB', player_salary: 5 }],
      current_price: 5
    })

    expect(capacity.available_cap).to.equal(5)
    expect(capacity.has_cap_space).to.equal(true)
    expect(capacity.is_eligible).to.equal(true)
  })

  it('drops a team one dollar short of the price', () => {
    const capacity = capacity_for({
      league_overrides: { salary_cap: 10 },
      players: [{ pos: 'QB', player_salary: 6 }],
      current_price: 5
    })

    expect(capacity.available_cap).to.equal(4)
    expect(capacity.has_cap_space).to.equal(false)
    expect(capacity.has_roster_space).to.equal(true)
    expect(capacity.has_position_capacity).to.equal(true)
    expect(capacity.is_eligible).to.equal(false)
  })

  it('keeps a $0 team eligible on a free player', () => {
    const capacity = capacity_for({
      league_overrides: { salary_cap: 5 },
      players: [{ pos: 'QB', player_salary: 5 }],
      current_price: 0
    })

    expect(capacity.available_cap).to.equal(0)
    expect(capacity.is_eligible).to.equal(true)
  })
})
