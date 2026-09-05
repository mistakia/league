/* global describe before beforeEach afterEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season } from '#constants'
import Auction from '#api/sockets/auction.mjs'
import getLeague from '#libs-server/get-league.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// A MODE THAT WILL NOT RESOLVE IS THE AUCTION LOSING ITS TERMINATION GUARANTEE,
// AND IT USED TO DO SO IN COMPLETE SILENCE.
//
// `_refresh_mode` is the only door into live mode. Nothing else moves a league
// into its final block, which is the design's sole guarantee that the auction
// ends. Its catch turns any throw inside the resolution into "stay in whichever
// mode you are already in and let the next poll retry" -- correct for a blip,
// and for a persistent fault it means the league never reaches its final block
// at all.
//
// The catch logged, so this reads as handled. It is not: `this.logger` is a
// `debug()` namespace and the production PM2 environment sets no DEBUG, so that
// line writes nothing on the deployed server. From outside the process a stuck
// mode was indistinguishable from a healthy one.
//
// THE THROW HERE IS THE REAL ONE. `getRoster` raises "No roster found" rather
// than returning empty when a team has no roster row, and
// `get_auction_final_block` reads every team's roster to size the board. So
// deleting a roster row reproduces the production shape exactly, rather than
// asserting against an injected error the resolution could never actually
// raise.
describe('a mode that will not resolve raises a signal', function () {
  let auction
  let signals

  // Records the emit and resolve calls instead of posting them. `emit_signal`
  // no-ops whenever BASE_API_URL and its two companions are unset, which is
  // every environment but production, so without this seam the call is
  // unobservable and a spec asserting on it would pass with the call deleted.
  const build_signals = () => {
    const emitted = []
    const resolved = []
    return {
      emitted,
      resolved,
      emit: async (signal) => {
        emitted.push(signal)
        return null
      },
      resolve: async (signal) => {
        resolved.push(signal)
        return null
      }
    }
  }

  const build_auction = () => {
    signals = build_signals()
    const instance = new Auction({
      wss: { clients: new Set() },
      lid: league_id,
      timers: { set_timeout: () => null, clear_timeout: () => {} },
      signals
    })
    instance._system_election_mode = true
    return instance
  }

  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(
      current_season.regular_season_start.subtract(1, 'month').toISOString()
    )
    await knex.seed.run()
  })

  afterEach(function () {
    if (auction) auction.stop()
    auction = null
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    await league(knex)
    await knex('seasons')
      .where({ lid: league_id, season_year })
      .update({
        free_agency_period_start: current_season.regular_season_start
          .subtract(2, 'months')
          .toDate(),
        free_agency_period_end: current_season.regular_season_start.toDate()
      })
    auction = build_auction()
    // Through getLeague, which is what the socket's own setup uses, so the
    // league this drives the resolution with is the one production would.
    auction._league = await getLeague({ lid: league_id })
  })

  const break_one_roster = async () => {
    const [team] = await knex('teams')
      .where({ lid: league_id, season_year })
      .orderBy('team_id')
      .limit(1)
    await knex('rosters_players').where({ tid: team.team_id }).del()
    await knex('rosters').where({ tid: team.team_id }).del()
    return team.team_id
  }

  it('emits a deduped pipeline_failure naming the consequence', async function () {
    this.timeout(60 * 1000)
    await break_one_roster()

    await auction._refresh_mode()

    expect(
      signals.emitted.length,
      'a resolution that throws must raise something a human can see'
    ).to.equal(1)

    const [signal] = signals.emitted
    expect(signal.kind).to.equal('pipeline_failure')
    expect(signal.severity).to.equal('high')
    expect(signal.payload.lid).to.equal(league_id)
    expect(signal.payload.consecutive_failures).to.equal(1)
    expect(
      signal.payload.consequence,
      'the signal states the consequence, not just the symptom'
    ).to.match(/final block/)
    expect(
      signal.dedup_key,
      'deduped on the league, so a per-minute poll does not become a per-minute signal'
    ).to.equal('pipeline_failure:auction-mode-resolution:1')
  })

  // THE PAIR, and without it the case above is equally consistent with a socket
  // that signals on every poll whatever happens. A healthy league on the same
  // fixture must raise nothing.
  it('raises nothing when the mode resolves', async function () {
    this.timeout(60 * 1000)

    await auction._refresh_mode()

    expect(
      signals.emitted,
      'a league whose rosters are intact is not a pipeline failure'
    ).to.deep.equal([])
  })

  it('counts consecutive failures, because one blip is not an outage', async function () {
    this.timeout(60 * 1000)
    await break_one_roster()

    await auction._refresh_mode()
    await auction._refresh_mode()
    await auction._refresh_mode()

    expect(signals.emitted.length).to.equal(3)
    expect(
      signals.emitted.map((signal) => signal.payload.consecutive_failures),
      'the count is the actionable content: three is a blip, three hundred is an outage'
    ).to.deep.equal([1, 2, 3])
  })

  // THE SIGNAL HAS TO CLOSE ITSELF, or a recurring detector is
  // indistinguishable from a stuck one after it first fires.
  it('resolves the signal once the mode resolves again', async function () {
    this.timeout(60 * 1000)
    const tid = await break_one_roster()

    await auction._refresh_mode()
    expect(signals.emitted.length).to.equal(1)

    await knex('rosters').insert({
      tid,
      lid: league_id,
      week: 0,
      season_year,
      last_updated: new Date()
    })

    await auction._refresh_mode()

    expect(signals.resolved.length, 'recovery closes the open signal').to.equal(
      1
    )
    expect(signals.resolved[0].dedup_key).to.equal(
      'pipeline_failure:auction-mode-resolution:1'
    )
    expect(signals.resolved[0].resolution_note).to.match(/1 consecutive/)
  })

  // BOOT RESOLVES ONCE, AND THAT IS NOT REDUNDANT WITH THE CASE ABOVE. PM2
  // reloads this process on every deploy, so a signal opened by the previous
  // process has nothing left in memory that remembers to close it -- an
  // in-process latch alone would strand it open forever, which is exactly what
  // `emit-signal.mjs` warns against.
  it('resolves once on the first healthy poll after boot', async function () {
    this.timeout(60 * 1000)

    await auction._refresh_mode()
    expect(
      signals.resolved.length,
      'the first healthy resolve closes anything a previous process left open'
    ).to.equal(1)

    await auction._refresh_mode()
    await auction._refresh_mode()

    expect(
      signals.resolved.length,
      'and then it goes quiet, so a per-minute poll is not a per-minute round trip'
    ).to.equal(1)
  })
})
