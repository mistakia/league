/* global describe before beforeEach afterEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season, transaction_types } from '#constants'
import Auction from '#api/sockets/auction.mjs'
import {
  run_auction_simulation,
  seeded_random,
  check_invariants,
  MANAGER_PROFILES
} from './utils/auction-simulator.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// THE ONLY THING THAT EXERCISES THE MECHANISMS AGAINST EACH OTHER.
//
// Every other auction spec isolates one rule and is right to. The defects this
// subsystem has actually produced live between the rules: a settlement racing a
// bid clock, a socket cache a REST write moved, a stall inheriting the final
// block. Each looked correct in the module that owned it.
//
// So this drives a whole board through the real write paths with a cast of
// managers who behave differently -- one states a ceiling and never attends, one
// declines everything, one never elects at all, one withdraws and re-elects --
// and asserts the model's monotonicity invariants after EVERY step rather than
// at the end, so a violation names the step that caused it.
describe('auction simulator', function () {
  let now
  let auction

  const build_timers = () => ({
    set_timeout: (fn, ms, name) => ({ fn, ms, name }),
    clear_timeout: () => {}
  })

  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  afterEach(function () {
    if (auction) auction.stop()
    auction = null
    MockDate.reset()
  })

  const start_auction = async () => {
    now = current_season.regular_season_start.subtract(1, 'month')
    MockDate.set(now.toISOString())
    await league(knex)

    await knex('seasons')
      .where({ lid: league_id, season_year })
      .update({
        free_agency_period_start: now.subtract(1, 'hour').toDate(),
        free_agency_period_end: now.add(5, 'day').toDate(),
        auction_block_notice_minutes: 60,
        is_auction_election_mode_enabled: true
      })

    // Full cap for every team. The draft fixture leaves teams OVER the cap --
    // one at -29 -- and an effective maximum is min(stated, availableCap), so on
    // the stock fixture every ceiling caps to nothing and the simulation would
    // be measuring the budget term rather than the interaction.
    await knex('transactions').where({ lid: league_id }).update({
      player_salary: 0
    })

    const instance = new Auction({
      wss: { clients: [] },
      lid: league_id,
      timers: build_timers()
    })
    instance.broadcast = () => {}
    await instance.setup()
    return instance
  }

  beforeEach(async function () {
    this.timeout(60 * 1000)
    auction = await start_auction()
  })

  it('holds every monotonicity invariant across a whole board', async function () {
    this.timeout(120 * 1000)

    const result = await run_auction_simulation({
      knex,
      auction,
      lid: league_id,
      seed: 20260903,
      max_players: 6
    })

    // Named, not counted: a failure has to say which step broke which rule or
    // the simulator is just a slower way of getting a red.
    expect(
      result.failures,
      `invariant violations:\n${result.failures.join('\n')}`
    ).to.have.length(0)

    // THE CONTROL ON THE WHOLE RUN. A simulation that nominated nothing and
    // settled nothing satisfies every invariant above perfectly, and that is
    // exactly the shape of a harness that has quietly stopped driving anything.
    expect(result.log.length, 'the simulation actually did work').to.be.above(
      20
    )
    expect(result.sold, 'players actually settled').to.be.above(0)

    const processed = await knex('transactions').where({
      lid: league_id,
      type: transaction_types.AUCTION_PROCESSED
    })
    expect(processed.length).to.equal(result.sold)

    // THE STALL PATH WAS ACTUALLY TRAVERSED. A run where every team elects
    // promptly exercises none of what this harness exists for, and would satisfy
    // every assertion above.
    const kinds = new Set(result.log.map((step) => step.kind))
    expect(kinds.has('stalled'), 'a holdout stalled a player').to.equal(true)
    expect(kinds.has('relent'), 'and then relented').to.equal(true)
    expect(
      kinds.has('withdraw'),
      'a ceiling was withdrawn mid-nomination'
    ).to.equal(true)
  })

  it('runs the same seed to the same log', async function () {
    this.timeout(120 * 1000)

    const first = await run_auction_simulation({
      knex,
      auction,
      lid: league_id,
      seed: 7,
      max_players: 3
    })

    auction.stop()
    auction = await start_auction()

    const second = await run_auction_simulation({
      knex,
      auction,
      lid: league_id,
      seed: 7,
      max_players: 3
    })

    // Reproducibility is what makes a failure actionable rather than a flake.
    expect(second.log).to.deep.equal(first.log)
    expect([...second.profiles]).to.deep.equal([...first.profiles])
  })

  it('runs a different seed to a different log', async function () {
    this.timeout(120 * 1000)

    // THE CONTROL on determinism. Two seeds agreeing would mean the seed reaches
    // nothing, and the assertion above would hold just as well against a
    // simulator that ignored it entirely.
    const first = await run_auction_simulation({
      knex,
      auction,
      lid: league_id,
      seed: 7,
      max_players: 3
    })

    auction.stop()
    auction = await start_auction()

    const other = await run_auction_simulation({
      knex,
      auction,
      lid: league_id,
      seed: 999,
      max_players: 3
    })

    expect(other.log).to.not.deep.equal(first.log)
  })

  // EACH INVARIANT DEMONSTRATED RED, against synthetic snapshots.
  //
  // A green simulation proves nothing until the checker is shown to fail on a
  // state it is supposed to reject -- and a checker is exactly the kind of code
  // that silently reports clean, because its healthy output and its broken
  // output are both an empty array.
  describe('the invariant checker', function () {
    const snapshot = (overrides = {}) => ({
      cap: new Map([
        [1, 100],
        [2, 100]
      ]),
      roster_count: new Map([
        [1, 3],
        [2, 3]
      ]),
      roster_pids: ['A', 'B', 'C', 'D', 'E', 'F'],
      processed: [],
      ...overrides
    })

    const failures_for = (after) =>
      check_invariants({
        before: snapshot(),
        after,
        step: { index: 4, kind: 'test' }
      })

    it('passes an unchanged pair', function () {
      expect(failures_for(snapshot())).to.have.length(0)
    })

    it('catches a remaining cap that rose', function () {
      const failures = failures_for(
        snapshot({
          cap: new Map([
            [1, 140],
            [2, 100]
          ])
        })
      )
      expect(failures).to.have.length(1)
      expect(failures[0]).to.match(/team 1 remaining cap ROSE/)
      expect(failures[0], 'names the step').to.match(/step 4/)
    })

    it('catches a roster that shrank', function () {
      const failures = failures_for(
        snapshot({
          roster_count: new Map([
            [1, 2],
            [2, 3]
          ])
        })
      )
      expect(failures).to.have.length(1)
      expect(failures[0]).to.match(/team 1 roster SHRANK/)
    })

    it('catches one player on two rosters', function () {
      const failures = failures_for(
        snapshot({ roster_pids: ['A', 'B', 'C', 'D', 'E', 'A'] })
      )
      expect(failures[0]).to.match(/A is on more than one roster/)
    })

    it('catches a player sold twice', function () {
      const failures = failures_for(
        snapshot({
          processed: [
            { tid: 1, pid: 'A', player_salary: 3 },
            { tid: 2, pid: 'A', player_salary: 4 }
          ]
        })
      )
      expect(
        failures.some((line) => /A sold more than once/.test(line))
      ).to.equal(true)
    })

    it('catches a sale that put nobody on a roster', function () {
      const failures = failures_for(
        snapshot({ processed: [{ tid: 1, pid: 'ZZZ', player_salary: 3 }] })
      )
      expect(failures[0]).to.match(/ZZZ sold to team 1 but is on no roster/)
    })

    it('catches a negative price', function () {
      const failures = failures_for(
        snapshot({ processed: [{ tid: 1, pid: 'A', player_salary: -2 }] })
      )
      expect(failures.some((line) => /negative price/.test(line))).to.equal(
        true
      )
    })
  })

  describe('the generator itself', function () {
    it('is reproducible and spreads across the unit interval', function () {
      const a = seeded_random(42)
      const b = seeded_random(42)
      const draws = Array.from({ length: 200 }, () => a())

      expect(draws).to.deep.equal(Array.from({ length: 200 }, () => b()))
      expect(Math.min(...draws)).to.be.at.least(0)
      expect(Math.max(...draws)).to.be.below(1)
      expect(new Set(draws).size, 'not a constant').to.be.above(150)
    })

    it('names every profile the plan calls for', function () {
      expect(Object.values(MANAGER_PROFILES)).to.have.members([
        'absent_ceiling',
        'decliner',
        'silent',
        'withdrawer'
      ])
    })
  })
})
