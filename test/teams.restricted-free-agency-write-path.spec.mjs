/* global describe before beforeEach it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season } from '#constants'
import { user1 } from './fixtures/token.mjs'
import { selectPlayer, addPlayer } from './utils/index.mjs'
import { insert_restricted_free_agency_bid } from './utils/insert-restricted-free-agency-bid.mjs'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chai_http)
const expect = chai.expect
const { regular_season_start } = current_season

// Write-path integrity for restricted free agency bids: how many live bids a
// team can hold on one player, and WHICH row an edit or a cancel lands on when
// more than one matches.
//
// The POST handler inserted unconditionally, so a manager who submitted twice
// got two rows both `cancelled IS NULL AND processed IS NULL`. The PUT and
// DELETE handlers then resolved a bid by (pid, tid, year) and took the first row
// of an unordered select, so with duplicates present they acted on an arbitrary
// one. Four settled (team, player, year) groups in league 1 carry duplicates
// from this, the oldest from 2021 -- it is longstanding, not a regression.
//
// These tests are why the ordering is not merely cosmetic: the partial unique
// index added alongside them prevents NEW live duplicates, but it cannot
// retroactively constrain the settled rows these same queries still read.
describe('API /teams - restricted free agency write path', function () {
  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    await league(knex)
  })

  const open_rfa_window = () =>
    MockDate.set(regular_season_start.subtract('2', 'month').toISOString())

  const post_bid = ({ pid, bid, teamId = 1, leagueId = 1 }) =>
    chai_request
      .execute(server)
      .post(`/api/teams/${teamId}/tag/restricted-free-agency`)
      .set('Authorization', `Bearer ${user1}`)
      .send({ leagueId, bid, pid, playerTid: teamId })

  describe('one live bid per team and player', function () {
    it('rejects a second live bid on the same player', async () => {
      open_rfa_window()

      const player = await selectPlayer()
      await addPlayer({ leagueId: 1, player, teamId: 1, userId: 1 })

      const first = await post_bid({ pid: player.pid, bid: 5 })
      first.should.have.status(200)

      // This is the request a manager makes when the interface has shown them a
      // blank or stale bid -- exactly what the 2026-08-05 display defect did for
      // thirteen hours, and how several managers created duplicate rows.
      const second = await post_bid({ pid: player.pid, bid: 9 })
      second.should.have.status(400)
      second.body.error.should.equal(
        'existing restricted free agency bid, update it instead'
      )

      const live_bids = await knex('restricted_free_agency_bids')
        .where({ pid: player.pid, tid: 1, season_year: current_season.year })
        .whereNull('cancelled')
        .whereNull('processed')

      expect(live_bids.length, 'a second live bid row was written').to.equal(1)
      expect(
        live_bids[0].bid_amount,
        'the rejected bid overwrote the first'
      ).to.equal(5)
    })

    it('leaves a settled bid free to be re-bid', async () => {
      // The guard must test LIVE bids only. A team whose prior bid on this
      // player was processed in an earlier auction has to be able to bid again,
      // and the partial index is scoped the same way.
      open_rfa_window()

      const player = await selectPlayer()
      await addPlayer({ leagueId: 1, player, teamId: 1, userId: 1 })

      await insert_restricted_free_agency_bid({
        pid: player.pid,
        lid: 1,
        tid: 1,
        bid_amount: 3,
        processed: new Date(),
        is_successful: false,
        year: current_season.year
      })

      const res = await post_bid({ pid: player.pid, bid: 8 })
      res.should.have.status(200)
    })
  })

  describe('resolving which bid an edit or cancel acts on', function () {
    // Seeds the shape the unordered selects could not handle: one settled bid
    // and one live bid from the same team on the same player. Returns both uids.
    const seed_settled_and_live = async () => {
      open_rfa_window()

      const player = await selectPlayer()
      await addPlayer({ leagueId: 1, player, teamId: 1, userId: 1 })

      const processed_bid_id = await insert_restricted_free_agency_bid({
        pid: player.pid,
        lid: 1,
        tid: 1,
        bid_amount: 3,
        processed: new Date(),
        is_successful: false,
        year: current_season.year
      })

      const res = await post_bid({ pid: player.pid, bid: 12 })
      res.should.have.status(200)

      const live = await knex('restricted_free_agency_bids')
        .where({ pid: player.pid, tid: 1, season_year: current_season.year })
        .whereNull('cancelled')
        .whereNull('processed')
        .first()

      expect(live, 'live bid not seeded').to.exist

      return { player, processed_bid_id, live_bid_id: live.uid }
    }

    it('PUT edits the live bid rather than rejecting on the settled one', async () => {
      // Before the ordering fix this could answer 400 "bid has already been
      // processed" against a team that held a perfectly editable live bid -- the
      // handler checked `.processed` on whichever row came back first.
      const { player, processed_bid_id, live_bid_id } =
        await seed_settled_and_live()

      const res = await chai_request
        .execute(server)
        .put('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({ leagueId: 1, bid: 19, pid: player.pid })

      res.should.have.status(200)

      const live = await knex('restricted_free_agency_bids')
        .where('uid', live_bid_id)
        .first()
      const processed = await knex('restricted_free_agency_bids')
        .where('uid', processed_bid_id)
        .first()

      expect(live.bid_amount, 'edit did not land on the live bid').to.equal(19)
      expect(processed.bid_amount, 'edit overwrote the settled bid').to.equal(3)
    })

    it('DELETE cancels the live bid rather than the settled one', async () => {
      const { player, processed_bid_id, live_bid_id } =
        await seed_settled_and_live()

      const res = await chai_request
        .execute(server)
        .delete('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({ leagueId: 1, pid: player.pid })

      res.should.have.status(200)

      const live = await knex('restricted_free_agency_bids')
        .where('uid', live_bid_id)
        .first()
      const processed = await knex('restricted_free_agency_bids')
        .where('uid', processed_bid_id)
        .first()

      expect(live.cancelled, 'the live bid was not the one cancelled').to.exist
      expect(processed.cancelled, 'the settled bid was cancelled instead').to.be
        .null
    })
  })
})
