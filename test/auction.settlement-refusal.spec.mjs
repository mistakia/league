/* global describe before beforeEach afterEach it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season } from '#constants'
import {
  submit_auction_election,
  withdraw_auction_election,
  get_auction_settlement_status
} from '#libs-server/auction-elections.mjs'
import { nominate_free_agent_running_back } from './utils/nominate-auction-player.mjs'
import { user2 } from './fixtures/token.mjs'

process.env.NODE_ENV = 'test'
chai.use(chai_http)
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// A SETTLEMENT THAT CANNOT BE WRITTEN MUST REFUSE THE ELECTION THAT TRIGGERED
// IT, RATHER THAN COMMIT THE ELECTION AND ABANDON THE SALE.
//
// `submit_auction_election` writes the election and settles the player in ONE
// transaction, so any throw inside the settlement already erased the election.
// That looks like something to catch away and is not: completeness is the only
// thing that advances an election-mode auction and there is no clock, so
// committing the election while dropping the settlement reaches a set that is
// EMPTY and UNSETTLED, with no remaining write able to trigger a sale. The
// player would sit open for the rest of the period while the board showed the
// auction waiting on nobody.
//
// So the rollback is the invariant. What was wrong is that it was MUTE: every
// throw in the settlement is a bare `Error`, so the manager got a 500 that says
// nothing, while the `team N elected X` log line had already printed ABOVE the
// settle call -- making a wiped election indistinguishable from an ordinary one
// in the log. It now refuses through `auction_election_error`, which the routes
// already branch on, and raises a signal.
//
// THE THROW HERE IS A REAL ONE. `getRoster` raises rather than returning empty
// for a team with no roster row, and the settlement reads the rosters of every
// contender, so deleting one reproduces a reachable production shape instead of
// asserting against an injected error the settlement could never raise.
describe('a settlement that cannot be written refuses the election', function () {
  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(
      current_season.regular_season_start.subtract(1, 'month').toISOString()
    )
    await knex.seed.run()
  })

  afterEach(function () {
    MockDate.reset()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    MockDate.set(
      current_season.regular_season_start.subtract(1, 'month').toISOString()
    )
    await league(knex)
    await knex('seasons')
      .where({ lid: league_id, season_year })
      .update({
        free_agency_period_start: current_season.regular_season_start
          .subtract(2, 'months')
          .toDate(),
        free_agency_period_end: current_season.regular_season_start.toDate()
      })
    // Every team can afford anything, so nothing here turns on a fixture cap.
    await knex('transactions')
      .where({ lid: league_id })
      .update({ player_salary: 0 })
  })

  // Records emissions instead of posting them. `emit_signal` no-ops whenever
  // BASE_API_URL and its two companions are unset, which is every environment
  // but production -- so without this seam the call is unobservable and a spec
  // asserting on it would pass with the call site deleted.
  const build_signals = () => {
    const emitted = []
    return { emitted, emit: async (signal) => emitted.push(signal) && null }
  }

  /**
   * Open a player on team 1 and elect for everyone the auction is waiting on
   * EXCEPT team 2, so team 2's election is the one that completes the field.
   *
   * Returns the pid and team 2's remaining position in the outstanding set,
   * asserted rather than assumed -- a board where team 2 was never outstanding
   * would make every case below vacuous.
   */
  const board_waiting_only_on_team_2 = async () => {
    const pid = await nominate_free_agent_running_back({
      lid: league_id,
      tid: 1,
      value: 1,
      user_id: 1,
      // The nominator states its own ceiling, so it is discharged and the field
      // closes on the other teams.
      maximum_bid: 1
    })

    const { outstanding_election_tids } = await get_auction_settlement_status({
      lid: league_id,
      season_year
    })
    expect(
      outstanding_election_tids,
      'team 2 is outstanding on the opened player'
    ).to.include(2)

    for (const tid of outstanding_election_tids.filter((tid) => tid !== 2)) {
      await submit_auction_election({
        lid: league_id,
        tid,
        pid,
        user_id: tid,
        maximum_bid: null,
        season_year
      })
    }

    const after = await get_auction_settlement_status({
      lid: league_id,
      season_year
    })
    expect(
      after.outstanding_election_tids,
      'the auction is now waiting on team 2 alone'
    ).to.deep.equal([2])

    return pid
  }

  // Removes the winner's roster row, which makes the settlement's own roster
  // read throw. Done LAST, because every election above settles-if-complete and
  // would hit the same throw early.
  const break_the_settlement = async () => {
    const rosters = await knex('rosters')
      .where({ lid: league_id, tid: 1, season_year })
      .del()
    expect(rosters, 'a roster row was actually removed').to.be.greaterThan(0)
  }

  const live_election_rows = (tid, pid) =>
    knex('auction_elections')
      .where({ lid: league_id, season_year, tid, pid })
      .whereNull('withdrawn_at')
      .whereNull('settled_at')

  const post_election = ({ teamId, pid, maximum_bid, token }) =>
    chai_request
      .execute(server)
      .post(`/api/leagues/${league_id}/auction-elections`)
      .set('Authorization', `Bearer ${token}`)
      .send({ teamId, pid, maximum_bid, leagueId: league_id })

  // THE PAIR. A single reading cannot tell a refusal from a board that was
  // never going to settle, so the healthy case runs the identical setup and is
  // required to produce the OPPOSITE result.
  it('settles normally when the settlement can be written', async function () {
    this.timeout(60 * 1000)

    const pid = await board_waiting_only_on_team_2()

    const res = await post_election({
      teamId: 2,
      pid,
      maximum_bid: null,
      token: user2
    })

    expect(res.status, JSON.stringify(res.body)).to.equal(200)
    expect(res.body.settlement, 'the player sold').to.exist
    expect(res.body.settlement.winner_tid).to.equal(1)
  })

  it('answers 400 rather than 500 when the settlement throws', async function () {
    this.timeout(60 * 1000)

    const pid = await board_waiting_only_on_team_2()
    await break_the_settlement()

    const res = await post_election({
      teamId: 2,
      pid,
      maximum_bid: null,
      token: user2
    })

    // The whole point of the change. This was a 500 carrying no message, on a
    // write the manager believed had landed.
    expect(res.status, JSON.stringify(res.body)).to.equal(400)
    expect(res.body.error, 'the refusal says what to do').to.be.a('string')
    expect(res.body.error).to.include('submit it again')
  })

  it('leaves the refusing team outstanding, so the set stays non-empty', async function () {
    this.timeout(60 * 1000)

    const pid = await board_waiting_only_on_team_2()
    await break_the_settlement()

    await post_election({ teamId: 2, pid, maximum_bid: null, token: user2 })

    // The invariant the refusal exists to keep. A committed election here would
    // empty the outstanding set with the player unsold and nothing left able to
    // trigger a settlement.
    const rows = await live_election_rows(2, pid)
    expect(rows, 'team 2 holds no election row').to.have.length(0)
  })

  it('raises a pipeline_failure naming the team and the player', async function () {
    this.timeout(60 * 1000)

    const pid = await board_waiting_only_on_team_2()
    await break_the_settlement()

    const signals = build_signals()
    let refused = null
    try {
      await submit_auction_election({
        lid: league_id,
        tid: 2,
        pid,
        user_id: 2,
        maximum_bid: null,
        season_year,
        signals
      })
    } catch (error) {
      refused = error
    }

    expect(refused, 'the election was refused').to.exist
    expect(refused.is_auction_election_error).to.equal(true)

    expect(signals.emitted, 'exactly one signal').to.have.length(1)
    const [signal] = signals.emitted
    expect(signal.kind).to.equal('pipeline_failure')
    expect(signal.payload.tid).to.equal(2)
    expect(signal.payload.pid).to.equal(pid)
    // Deduped per player, so a manager retrying does not open a new signal on
    // every attempt.
    expect(signal.dedup_key).to.include(String(pid))
  })

  // THE WITHDRAWAL PATH CARRIES THE IDENTICAL WEDGE, because it also settles
  // inside the transaction that writes the withdrawal -- a withdrawn maximum
  // can COMPLETE a field rather than only reopen one.
  it('refuses a withdrawal whose settlement cannot be written', async function () {
    this.timeout(60 * 1000)

    const pid = await nominate_free_agent_running_back({
      lid: league_id,
      tid: 1,
      value: 1,
      user_id: 1,
      maximum_bid: 1
    })

    // Team 2 alone elects, so the field stays INCOMPLETE and the player does
    // not sell. That is deliberate: the withdrawal path calls
    // `settle_auction_player_if_complete` unconditionally, and the capacities it
    // reads are read BEFORE the completeness check -- so the throw is reached
    // whether or not this withdrawal would have completed anything.
    await submit_auction_election({
      lid: league_id,
      tid: 2,
      pid,
      user_id: 2,
      maximum_bid: 5,
      season_year
    })

    expect(
      await live_election_rows(2, pid),
      'team 2 holds a live maximum to withdraw'
    ).to.have.length(1)

    await break_the_settlement()

    const signals = build_signals()
    let refused = null
    try {
      await withdraw_auction_election({
        lid: league_id,
        tid: 2,
        pid,
        season_year,
        signals
      })
    } catch (error) {
      refused = error
    }

    expect(refused, 'the withdrawal was refused').to.exist
    expect(refused.is_auction_election_error).to.equal(true)
    expect(refused.message).to.include('withdrawal')

    // The withdrawal rolled back with it, so the maximum still stands.
    const rows = await live_election_rows(2, pid)
    expect(rows, 'the election survives the refused withdrawal').to.have.length(
      1
    )

    expect(signals.emitted, 'the refusal signalled').to.have.length(1)
    expect(signals.emitted[0].payload.verb).to.equal('withdrawal')
  })
})
