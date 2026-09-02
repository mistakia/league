/* global describe before after beforeEach afterEach it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'
import WebSocket from 'ws'

import server from '#api'
import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season, transaction_types } from '#constants'
import { submit_auction_election } from '#libs-server/auction-elections.mjs'
import {
  announce_auction_settlement,
  broadcast_auction_settlement
} from '#libs-server/auction-settlement.mjs'
import {
  format_nomination_complete_message,
  format_nomination_message
} from '#libs-server/format-auction-discord-message.mjs'
import { user2 } from './fixtures/token.mjs'

process.env.NODE_ENV = 'test'
chai.use(chai_http)
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// THE SETTLEMENT DISCORD MESSAGE, which shipped guarded by a comment and
// nothing else.
//
// `test/auction.election-broadcast.spec.mjs` names three defects its fix
// addressed and asserts two of them. The third -- "no Discord message went out
// on any settlement" -- appeared only in that comment, and no spec anywhere
// referenced `format_nomination_complete_message`. The drive script cannot
// reach it either: both webhook columns are null on the mirror league by design
// and `send-notifications` refuses outside `NODE_ENV=production`, so it reports
// delivery as not drivable and, unlike its other two not-drivable checks, names
// no covering spec.
//
// THE COVERAGE IS A CHAIN, AND EACH LINK IS A SEPARATE CASE, because no single
// assertion can span it. There is no module-stubbing dependency in this repo
// (`mockdate` is the only mock), and the alternative -- flipping `NODE_ENV` to
// production so `send-notifications` proceeds -- would disable the test-env
// response validator in `api/swagger/response-validation.mjs`, which is the
// guard that caught both election write verbs answering 500 on a declared
// bodyless 200. So:
//
//   1. the REST election route reaches the settlement fan-out          (case 4)
//   2. the fan-out CALLS its announcer, once, with the settled player  (case 2)
//   3. the default announcer is the real one and reaches the builder   (case 3)
//   4. the builder produces a message naming team, player and price    (case 1)
//
// Case 2 is the one the defect needs. Mutating the message builder's body does
// not prove the builder is CALLED, and this subsystem has already shipped three
// award specs that passed while their guard's invocation could be deleted
// wholesale -- so the mutant scored against case 2 is DELETING the
// `await announce(...)` line in `broadcast_auction_settlement`, not editing
// anything inside `announce_auction_settlement`.
describe('auction settlement announcement', function () {
  let port
  let opened_listener = false

  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()

    // The suite already has this server listening, and listening twice throws.
    if (!server.listening) {
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
      opened_listener = true
    }
    port = server.address().port
  })

  after(function () {
    if (opened_listener) server.close()
  })

  afterEach(function () {
    MockDate.reset()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    MockDate.set(
      current_season.regular_season_start.subtract('1', 'month').toISOString()
    )
    await league(knex)

    // The elections write path refuses outside the free agency period, and the
    // shared league fixture configures none.
    await knex('seasons')
      .where({ lid: league_id, season_year })
      .update({
        free_agency_period_start: current_season.regular_season_start
          .subtract(2, 'months')
          .toDate(),
        free_agency_period_end: current_season.regular_season_start.toDate()
      })
  })

  const team_ids = async () => {
    const teams = await knex('teams')
      .where({ lid: league_id, season_year })
      .orderBy('draft_order')
    return teams.map((team) => team.team_id)
  }

  // A free agent nobody holds, opened at $0 so every team with an open active
  // spot is eligible regardless of budget -- the draft fixture leaves teams over
  // the cap, and a priced nomination would disqualify them all before the
  // settlement under test ever happened.
  const nominate_free_agent = async ({ tid }) => {
    const rostered = await knex('rosters_players')
      .join('rosters', 'rosters.roster_id', 'rosters_players.roster_id')
      .where('rosters.lid', league_id)
      .pluck('rosters_players.pid')

    const [player] = await knex('player')
      .whereNot('current_nfl_team', 'INA')
      .where('primary_position', 'RB')
      .whereNotIn('pid', rostered.length ? rostered : [''])
      .orderBy('pid')
      .limit(1)
    expect(player, 'an unrostered running back').to.exist

    await knex('transactions').insert({
      user_id: 1,
      tid,
      pid: player.pid,
      lid: league_id,
      type: transaction_types.AUCTION_BID,
      player_salary: 0,
      week: 0,
      season_year,
      occurred_at: new Date()
    })

    return player.pid
  }

  // Drives a real settlement to completion and hands back the settlement row.
  // Every team but the nominator and team 2 declines up front, then team 2's
  // election completes the eligible set.
  const settle_a_player = async () => {
    const tids = await team_ids()
    const pid = await nominate_free_agent({ tid: 1 })

    for (const tid of tids) {
      if (tid === 1 || tid === 2) continue
      await submit_auction_election({
        lid: league_id,
        tid,
        pid,
        user_id: 1,
        maximum_bid: null
      })
    }

    const result = await submit_auction_election({
      lid: league_id,
      tid: 2,
      pid,
      user_id: 2,
      maximum_bid: 1
    })

    expect(result.settlement, 'the last election settles the player').to.exist
    return result.settlement
  }

  // CASE 1 -- the message builder. Content only: this cannot tell a called
  // builder from an uncalled one, which is what case 2 is for.
  it('builds a settlement message naming the team, the player and the price', async function () {
    this.timeout(60 * 1000)

    const settlement = await settle_a_player()

    const message = await format_nomination_complete_message({
      player_id: settlement.pid,
      winning_bid_amount: settlement.price,
      winning_team_id: settlement.winner_tid
    })

    const player = await knex('player').where({ pid: settlement.pid }).first()
    const team = await knex('teams')
      .where({ team_id: settlement.winner_tid, season_year })
      .first()

    expect(message, 'a message is produced').to.be.a('string')
    expect(message, 'names the winning team').to.include(team.name)
    expect(message, 'names the player').to.include(player.first_name)
    expect(message, 'names the player').to.include(player.last_name)
    expect(message, 'names the position').to.include(player.primary_position)
    expect(message, 'names the price').to.include(`$${settlement.price}`)
  })

  // CASE 2 -- THE ASSERTION THIS SPEC EXISTS FOR.
  //
  // The fan-out must CALL its announcer. Delete the `await announce(...)` line
  // in `broadcast_auction_settlement` and this case must go red while the sale
  // broadcast below still arrives -- that pairing is the whole point, because a
  // settlement that broadcasts the sale and announces nothing is exactly the
  // defect that shipped.
  it('announces the settled player once from the settlement fan-out', async function () {
    this.timeout(60 * 1000)

    const settlement = await settle_a_player()

    const announced = []
    const broadcasts = []

    await broadcast_auction_settlement({
      broadcast: (lid, message) => broadcasts.push({ lid, message }),
      lid: league_id,
      settlement,
      announce: async (args) => announced.push(args)
    })

    expect(announced, 'the fan-out announces exactly once').to.have.length(1)
    expect(announced[0].settlement.pid, 'the settled player').to.equal(
      settlement.pid
    )
    expect(announced[0].settlement.winner_tid, 'the winning team').to.equal(
      settlement.winner_tid
    )
    expect(announced[0].settlement.price, 'the sale price').to.equal(
      settlement.price
    )
    expect(announced[0].lid, 'the league').to.equal(league_id)

    // The control. If this were absent, a fan-out that did nothing at all would
    // fail case 2 for the wrong reason and the mutant would not be scored on
    // the announce call specifically.
    expect(
      broadcasts.map((entry) => entry.message.type),
      'the sale is still broadcast'
    ).to.include('AUCTION_PROCESSED')
  })

  // CASE 3 -- the DEFAULT announcer is the real one.
  //
  // Case 2 injects, so on its own it cannot tell the shipped default from a
  // no-op. This calls the fan-out with NO announcer against a settlement naming
  // a player that does not exist: the real builder throws `Player not found`,
  // the fan-out's guard catches it and hands it to `logger`. A default that
  // never reached the builder would log nothing.
  it('wires the real announcer by default', async function () {
    this.timeout(60 * 1000)

    const logged = []
    const broadcasts = []

    await broadcast_auction_settlement({
      broadcast: (lid, message) => broadcasts.push({ lid, message }),
      lid: league_id,
      settlement: { pid: 'NOPE-NOPE-999999', winner_tid: 1, price: 5 },
      logger: (error) => logged.push(error)
    })

    expect(
      logged,
      'the default announcer ran and reached the builder'
    ).to.have.length(1)
    expect(String(logged[0].message)).to.include('Player not found')

    // The guard: a notification failure must never take the sale broadcast down
    // with it. The sale has already committed by the time the fan-out runs.
    expect(
      broadcasts.map((entry) => entry.message.type),
      'the sale is broadcast despite the announcement failing'
    ).to.include('AUCTION_PROCESSED')
  })

  // CASE 3b -- the announcer itself, driven directly on a real settlement.
  // Proves `announce_auction_settlement` resolves the league it was not given
  // and returns the built message rather than silently producing nothing.
  it('resolves the league and returns the message it sent', async function () {
    this.timeout(60 * 1000)

    const settlement = await settle_a_player()
    const message = await announce_auction_settlement({
      lid: league_id,
      settlement
    })

    const team = await knex('teams')
      .where({ team_id: settlement.winner_tid, season_year })
      .first()

    expect(message, 'the announcer returns its message').to.be.a('string')
    expect(message, 'and it is the settlement message').to.include(team.name)
  })

  // CASE 4 -- the route reaches the fan-out.
  //
  // Drives the REAL ROUTE rather than the library, because a spec against
  // `submit_auction_election` alone stays green with the handler unwired -- and
  // both election write verbs declared a bodyless 200 and answered 500 under
  // the response validator for exactly as long as no spec called them. Driven
  // as user 2, not user 1: user 1 IS the fixture commissioner and the auction's
  // commissioner branches skip guards, so a settlement driven as user 1 can be
  // testing nothing.
  it('reaches the settlement fan-out from the REST election route', async function () {
    this.timeout(60 * 1000)

    const tids = await team_ids()
    const pid = await nominate_free_agent({ tid: 1 })

    for (const tid of tids) {
      if (tid === 1 || tid === 2) continue
      await submit_auction_election({
        lid: league_id,
        tid,
        pid,
        user_id: 1,
        maximum_bid: null
      })
    }

    const socket = new WebSocket(
      `ws://127.0.0.1:${port}/?league_id=${league_id}`
    )
    const received = []
    socket.on('message', (data) => received.push(JSON.parse(data)))
    await new Promise((resolve, reject) => {
      socket.on('open', resolve)
      socket.on('error', reject)
    })

    try {
      const res = await chai_request
        .execute(server)
        .post(`/api/leagues/${league_id}/auction-elections`)
        .set('Authorization', `Bearer ${user2}`)
        .send({ teamId: 2, pid, maximum_bid: 1, leagueId: league_id })

      expect(res.status, JSON.stringify(res.body)).to.equal(200)
      expect(res.body.settlement, 'the route settles the player').to.exist

      // AUCTION_PROCESSED is emitted by `broadcast_auction_settlement` and by
      // nothing else on this path, so its arrival is the evidence that the
      // route reached the fan-out whose announce call case 2 pins.
      //
      // COUNTED ATTEMPTS, NOT A `Date.now()` DEADLINE. The clock is frozen by
      // `MockDate` for the whole describe block, so a `Date.now() + 5000` bound
      // never expires and a message that never arrives spins here until mocha's
      // own timeout fires -- which reports a hang rather than the missing
      // broadcast, and costs a minute to say it. Severing the route's call to
      // the fan-out is exactly that case, and it is the mutant this assertion
      // is scored against, so the bound has to survive a stopped clock.
      let processed = null
      for (let attempt = 0; attempt < 200 && !processed; attempt++) {
        processed = received.find((entry) => entry.type === 'AUCTION_PROCESSED')
        if (!processed) await new Promise((resolve) => setTimeout(resolve, 25))
      }

      expect(processed, 'the route reached the settlement fan-out').to.exist
      expect(processed.payload.pid).to.equal(pid)
    } finally {
      socket.close()
    }
  })

  // THE SAME HOLE, ONE MESSAGE OVER.
  //
  // `format_nomination_message` is the announcement at the OTHER end of a
  // player -- it opens the nomination and names whom the auction is waiting on,
  // where `format_nomination_complete_message` closes it. It sits behind the
  // same election-mode gate, is reached from the same swallow-everything
  // `try/catch`, and until now no spec anywhere referenced it either.
  //
  // WHAT THIS COVERS AND WHAT IT DOES NOT. These are builder cases -- the
  // equivalent of case 1 above, and they carry its limitation: content
  // assertions cannot tell a called builder from an uncalled one. The
  // corresponding case 2, that `_send_nomination_notification` actually calls
  // it, has no seam to hang on. `announce_auction_settlement` is injectable
  // because e817d65cc made it so; the nomination path has no such parameter,
  // and adding one is a runtime change on a live auction. Left explicitly
  // uncovered rather than papered over with a content assertion dressed up as
  // an invocation one.
  describe('the nomination announcement', function () {
    it('names the team, the player and the amount it opened at', async function () {
      this.timeout(60 * 1000)

      const tids = await team_ids()
      const pid = await nominate_free_agent({ tid: 1 })
      const outstanding = tids.filter((tid) => tid !== 1)

      const message = await format_nomination_message({
        team_id: 1,
        player_id: pid,
        bid_amount: 0,
        eligible_teams: outstanding,
        is_nomination: true
      })

      const player = await knex('player').where({ pid }).first()
      const team = await knex('teams')
        .where({ team_id: 1, season_year })
        .first()

      expect(message, 'a message is produced').to.be.a('string')
      expect(message, 'names the nominating team').to.include(team.name)
      expect(message, 'names the player').to.include(player.first_name)
      expect(message, 'names the player').to.include(player.last_name)
      expect(message, 'names the position').to.include(player.primary_position)
      // $0 is the mainline opening bid and the value a template that reaches
      // for a falsy check drops silently, so it is the amount worth pinning.
      expect(message, 'names the opening amount').to.include('$0')
      expect(message, 'says it was a nomination').to.include('nominated')
    })

    // WHOM THE AUCTION IS WAITING ON IS THE ACTIONABLE CONTENT of this message
    // -- it is the only place a manager learns the player is waiting on THEM.
    // `format_team_list` drops any team it cannot resolve with a silent
    // `.filter(team !== null)`, so a partial list reads exactly like a complete
    // one. Assert every outstanding team by name rather than that the list is
    // non-empty.
    it('names every team the auction is still waiting on', async function () {
      this.timeout(60 * 1000)

      const tids = await team_ids()
      const pid = await nominate_free_agent({ tid: 1 })
      const outstanding = tids.filter((tid) => tid !== 1)
      expect(outstanding.length, 'more than one team is waiting').to.be.above(1)

      const message = await format_nomination_message({
        team_id: 1,
        player_id: pid,
        bid_amount: 0,
        eligible_teams: outstanding,
        is_nomination: true
      })

      const teams = await knex('teams')
        .whereIn('team_id', outstanding)
        .where({ season_year })
      expect(teams.length, 'every outstanding team resolves').to.equal(
        outstanding.length
      )
      for (const team of teams) {
        expect(message, `names waiting team ${team.team_id}`).to.include(
          team.name
        )
      }
    })

    // A NAME IT CANNOT RESOLVE MUST STOP THE MESSAGE, not garnish it. The
    // caller wraps this in a catch that logs and returns false, so a throw
    // costs the announcement; a malformed string would instead announce a
    // nomination naming the wrong player to the whole league.
    it('refuses to build a message for a player it cannot find', async function () {
      this.timeout(60 * 1000)

      let error = null
      try {
        await format_nomination_message({
          team_id: 1,
          player_id: 'NOSU-CHPL-999999',
          bid_amount: 0,
          eligible_teams: await team_ids(),
          is_nomination: true
        })
      } catch (caught) {
        error = caught
      }

      expect(error, 'an unknown player throws').to.be.an('error')
      expect(error.message).to.include('NOSU-CHPL-999999')
    })
  })
})
