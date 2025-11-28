/* global describe before beforeEach it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/seeds/league.mjs'
import { getRoster, getLeague } from '#libs-server'
import { current_season, player_tag_types } from '#constants'
import { user1, user2 } from './fixtures/token.mjs'
import {
  selectPlayer,
  fillRoster,
  addPlayer,
  notLoggedIn,
  missing,
  invalid,
  error
} from './utils/index.mjs'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chai_http)
const expect = chai.expect
const { regular_season_start } = current_season

describe('API /teams - restricted free agency', function () {
  before(async function () {
    this.timeout(60 * 1000)

    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())

    await knex.seed.run()
  })

  describe('post', function () {
    beforeEach(async function () {
      await league(knex)
    })

    it('original team', async () => {
      MockDate.set(regular_season_start.subtract('2', 'month').toISOString())

      const player = await selectPlayer()
      const exclude_pids = [player.pid]
      const releasePlayer = await selectPlayer({ exclude_pids })
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const bid = 1

      await addPlayer({
        leagueId,
        player,
        teamId,
        userId
      })

      await addPlayer({
        leagueId,
        player: releasePlayer,
        teamId,
        userId
      })

      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          bid,
          playerTid: teamId,
          release: [releasePlayer.pid],
          pid: player.pid
        })

      res.should.have.status(200)

      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.userid.should.equal(userId)
      res.body.pid.should.equal(player.pid)
      res.body.submitted.should.equal(Math.round(Date.now() / 1000))
      res.body.bid.should.equal(bid)
      res.body.year.should.equal(current_season.year)
      res.body.player_tid.should.equal(teamId)
      res.body.uid.should.be.a('number')
      res.body.uid.should.be.above(0)
      res.body.release.should.be.an('array')
      res.body.release.length.should.equal(1)
      res.body.release[0].should.equal(releasePlayer.pid)

      const query1 = await knex('restricted_free_agency_bids').select()

      query1.length.should.equal(1)
      query1[0].uid.should.be.a('number')
      query1[0].uid.should.be.above(0)
      query1[0].pid.should.equal(player.pid)
      query1[0].userid.should.equal(userId)
      query1[0].bid.should.equal(bid)
      query1[0].year.should.equal(current_season.year)
      query1[0].tid.should.equal(teamId)
      query1[0].player_tid.should.equal(teamId)
      query1[0].lid.should.equal(leagueId)
      expect(query1[0].succ).to.equal(null)
      expect(query1[0].reason).to.equal(null)
      expect(query1[0].submitted).to.equal(Math.round(Date.now() / 1000))
      expect(query1[0].processed).to.equal(null)
      expect(query1[0].cancelled).to.equal(null)

      const query2 = await knex('restricted_free_agency_releases').select()

      query2.length.should.equal(1)
      query2[0].restricted_free_agency_bid_id.should.be.a('number')
      query2[0].restricted_free_agency_bid_id.should.be.above(0)
      query2[0].pid.should.equal(releasePlayer.pid)

      res.body.uid.should.equal(query1[0].uid)
      query1[0].uid.should.equal(query2[0].restricted_free_agency_bid_id)

      const roster = await getRoster({ tid: teamId })

      const taggedPlayer = roster.players.find((p) => p.pid === player.pid)
      taggedPlayer.tag.should.equal(player_tag_types.RESTRICTED_FREE_AGENCY)
    })

    it('competing team', async () => {
      MockDate.set(regular_season_start.subtract('2', 'month').toISOString())

      const leagueId = 1
      const playerTid = 2
      const userId = 1
      const bid = 10

      const player = await selectPlayer()
      await addPlayer({
        leagueId,
        player,
        teamId: playerTid,
        userId: 2
      })

      const res1 = await chai_request
        .execute(server)
        .post('/api/teams/2/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          leagueId,
          bid: 1,
          playerTid,
          pid: player.pid
        })

      res1.should.have.status(200)

      const res2 = await chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          bid,
          playerTid,
          pid: player.pid
        })

      res2.should.have.status(200)

      res2.should.be.json

      res2.body.tid.should.equal(1)
      res2.body.userid.should.equal(userId)
      res2.body.pid.should.equal(player.pid)
      res2.body.year.should.equal(current_season.year)
      res2.body.submitted.should.equal(Math.round(Date.now() / 1000))
      res2.body.bid.should.equal(bid)
      res2.body.player_tid.should.equal(playerTid)
      res2.body.release.length.should.equal(0)
    })

    it('original team with cutlist and release, salary cap check', async () => {
      MockDate.set(regular_season_start.subtract('2', 'month').toISOString())

      const teamId = 1
      const leagueId = 1
      const userId = 1
      const bid = 10

      const league = await getLeague({ lid: leagueId })

      const exclude_pids = []
      const tagPlayer = await selectPlayer()
      await addPlayer({
        leagueId,
        player: tagPlayer,
        teamId,
        userId
      })
      exclude_pids.push(tagPlayer.pid)

      const cutlistPlayer = await selectPlayer({ exclude_pids })
      await addPlayer({
        leagueId,
        player: cutlistPlayer,
        teamId,
        userId,
        value: league.cap - bid + 1
      })
      exclude_pids.push(cutlistPlayer.pid)

      const releasePlayer = await selectPlayer({ exclude_pids })
      await addPlayer({
        leagueId,
        player: releasePlayer,
        teamId,
        userId,
        value: bid
      })
      exclude_pids.push(releasePlayer.pid)

      await fillRoster({
        leagueId,
        teamId,
        exclude_reserve_short_term: true,
        exclude_pids
      })

      const res1 = await chai_request
        .execute(server)
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          pids: cutlistPlayer.pid
        })

      res1.should.have.status(200)

      const res2 = await chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          bid,
          playerTid: teamId,
          pid: tagPlayer.pid,
          release: releasePlayer.pid
        })

      res2.should.have.status(200)

      res2.should.be.json

      res2.body.tid.should.equal(teamId)
      res2.body.userid.should.equal(userId)
      res2.body.year.should.equal(current_season.year)
      res2.body.pid.should.equal(tagPlayer.pid)
      res2.body.submitted.should.equal(Math.round(Date.now() / 1000))
      res2.body.bid.should.equal(bid)
      res2.body.player_tid.should.equal(teamId)
      res2.body.release.length.should.equal(1)
      res2.body.release[0].should.equal(releasePlayer.pid)
    })

    it('remove tag', async () => {
      // TODO
      // TODO - check to make sure cancelled is set
    })

    it('tag player on cutlist', async () => {
      // TODO
    })

    it('should not allow restricted free agent tag after RFA period deadline', async () => {
      const player = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const bid = 1

      await addPlayer({
        leagueId,
        player,
        teamId,
        userId
      })

      // Set league tran_end to a past date
      await knex('seasons')
        .where({ lid: leagueId, year: current_season.year })
        .update({ tran_end: Math.floor(Date.now() / 1000) - 86400 }) // 1 day ago

      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          bid,
          playerTid: teamId,
          pid: player.pid
        })

      res.should.have.status(400)
      res.body.error.should.equal('restricted free agency deadline has passed')

      // Reset the league tran_end
      await knex('seasons')
        .where({ lid: leagueId, year: current_season.year })
        .update({ tran_end: null })
    })

    it('should not allow competing RFA bid for a player whose bid has already been processed', async () => {
      const player = await selectPlayer()
      const original_team_id = 1
      const competing_team_id = 2
      const league_id = 1
      const user_id = 1
      const bid = 1

      // Add player to the original team
      await addPlayer({
        leagueId: league_id,
        player,
        teamId: original_team_id,
        userId: user_id
      })

      // Create initial RFA bid
      const initial_bid_res = await chai_request
        .execute(server)
        .post(`/api/teams/${original_team_id}/tag/restricted-free-agency`)
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: league_id,
          bid,
          playerTid: original_team_id,
          pid: player.pid
        })

      initial_bid_res.should.have.status(200)

      // Process the initial bid
      await knex('restricted_free_agency_bids')
        .where({
          pid: player.pid,
          tid: original_team_id,
          lid: league_id,
          year: current_season.year
        })
        .update({ processed: Math.round(Date.now() / 1000) })

      // Attempt to create a competing bid
      const competing_bid_res = await chai_request
        .execute(server)
        .post(`/api/teams/${competing_team_id}/tag/restricted-free-agency`)
        .set('Authorization', `Bearer ${user2}`)
        .send({
          leagueId: league_id,
          bid: bid + 1,
          playerTid: original_team_id,
          pid: player.pid
        })

      competing_bid_res.should.have.status(400)
      competing_bid_res.body.error.should.equal('invalid player')
    })
  })

  describe('put', function () {
    beforeEach(async function () {
      await league(knex)
    })

    it('update bid amount', async () => {
      MockDate.set(regular_season_start.subtract('2', 'month').toISOString())

      const player = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const initialBid = 1
      const updatedBid = 5

      await addPlayer({
        leagueId,
        player,
        teamId,
        userId
      })

      // Create initial RFA bid
      const res1 = await chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          bid: initialBid,
          playerTid: teamId,
          pid: player.pid
        })

      res1.should.have.status(200)

      // Update the bid
      const res2 = await chai_request
        .execute(server)
        .put('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          bid: updatedBid,
          pid: player.pid
        })

      res2.should.have.status(200)
      res2.body.bid.should.equal(updatedBid)

      const query = await knex('restricted_free_agency_bids')
        .where({ pid: player.pid })
        .first()
      query.bid.should.equal(updatedBid)
    })

    it('update release players', async () => {
      MockDate.set(regular_season_start.subtract('2', 'month').toISOString())

      const player = await selectPlayer()
      const releasePlayer1 = await selectPlayer({ exclude_pids: [player.pid] })
      const releasePlayer2 = await selectPlayer({
        exclude_pids: [player.pid, releasePlayer1.pid]
      })
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const bid = 1

      await addPlayer({ leagueId, player, teamId, userId })
      await addPlayer({ leagueId, player: releasePlayer1, teamId, userId })
      await addPlayer({ leagueId, player: releasePlayer2, teamId, userId })

      // Create initial RFA bid with one release player
      const res1 = await chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          bid,
          playerTid: teamId,
          pid: player.pid,
          release: [releasePlayer1.pid]
        })

      res1.should.have.status(200)

      // Update the release players
      const res2 = await chai_request
        .execute(server)
        .put('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          bid,
          pid: player.pid,
          release: [releasePlayer2.pid]
        })

      res2.should.have.status(200)
      res2.body.release.should.deep.equal([releasePlayer2.pid])

      const query = await knex('restricted_free_agency_releases').where({
        restricted_free_agency_bid_id: res2.body.uid
      })
      query.should.have.lengthOf(1)
      query[0].pid.should.equal(releasePlayer2.pid)
    })

    it('error - invalid player', async () => {
      const invalidPid = 'invalid_pid'
      const request = chai_request
        .execute(server)
        .put('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          bid: 1,
          pid: invalidPid
        })

      await invalid(request, 'player')
    })
  })

  describe('nominate', function () {
    beforeEach(async function () {
      await league(knex)
    })

    it('set RFA player as nominated', async () => {
      MockDate.set(regular_season_start.subtract('2', 'month').toISOString())

      const player = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const bid = 1

      await addPlayer({
        leagueId,
        player,
        teamId,
        userId
      })

      // Create initial restricted free agency bid
      const res1 = await chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          bid,
          playerTid: teamId,
          pid: player.pid
        })

      res1.should.have.status(200)

      // Nominate the player
      const res2 = await chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency/nominate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          pid: player.pid
        })

      res2.should.have.status(200)
      res2.body.should.have.property('nominated')
      res2.body.nominated.should.be.a('number')
      res2.body.nominated.should.be.closeTo(Math.round(Date.now() / 1000), 5)

      const query = await knex('restricted_free_agency_bids')
        .where({ pid: player.pid })
        .first()

      query.nominated.should.be.a('number')
      query.nominated.should.be.closeTo(Math.round(Date.now() / 1000), 5)
    })

    it('remove a nomination', async () => {
      MockDate.set(regular_season_start.subtract('2', 'month').toISOString())

      const player = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const bid = 1

      await addPlayer({
        leagueId,
        player,
        teamId,
        userId
      })

      // Create initial RFA bid
      const res1 = await chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          bid,
          playerTid: teamId,
          pid: player.pid
        })

      res1.should.have.status(200)

      // Nominate the player
      const res2 = await chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency/nominate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          pid: player.pid
        })

      res2.should.have.status(200)

      // Remove the nomination
      const res3 = await chai_request
        .execute(server)
        .delete('/api/teams/1/tag/restricted-free-agency/nominate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          pid: player.pid
        })

      res3.should.have.status(200)
      res3.body.message.should.equal(
        'Restricted free agent nomination successfully cancelled'
      )

      const query = await knex('restricted_free_agency_bids')
        .where({ pid: player.pid })
        .first()

      expect(query.nominated).to.equal(null)
    })

    it('error - nominate non-existent RFA bid', async () => {
      const player = await selectPlayer()
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency/nominate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          pid: player.pid
        })

      await invalid(request, 'restricted free agent bid')
    })

    it('error - nominate already processed bid', async () => {
      const player = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const bid = 1

      await addPlayer({
        leagueId,
        player,
        teamId,
        userId
      })

      // Create initial RFA bid
      const res1 = await chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          bid,
          playerTid: teamId,
          pid: player.pid
        })

      res1.should.have.status(200)

      // Simulate processing the bid
      await knex('restricted_free_agency_bids')
        .where({ pid: player.pid })
        .update({ processed: Math.floor(Date.now() / 1000) })

      // Attempt to nominate the processed bid
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency/nominate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          pid: player.pid
        })

      await error(request, 'bid has already been processed')
    })

    it('error - remove nomination for non-existent RFA bid', async () => {
      const player = await selectPlayer()
      const request = chai_request
        .execute(server)
        .delete('/api/teams/1/tag/restricted-free-agency/nominate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          pid: player.pid
        })

      await invalid(request, 'restricted free agent bid')
    })

    it('error - remove nomination for already processed bid', async () => {
      const player = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const bid = 1

      await addPlayer({
        leagueId,
        player,
        teamId,
        userId
      })

      // Create initial RFA bid
      const res1 = await chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          bid,
          playerTid: teamId,
          pid: player.pid
        })

      res1.should.have.status(200)

      // Simulate processing the bid
      await knex('restricted_free_agency_bids')
        .where({ pid: player.pid })
        .update({ processed: Math.floor(Date.now() / 1000) })

      // Attempt to remove nomination for the processed bid
      const request = chai_request
        .execute(server)
        .delete('/api/teams/1/tag/restricted-free-agency/nominate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          pid: player.pid
        })

      await error(request, 'bid has already been processed')
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      await league(knex)
    })

    it('not logged in', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency')
      await notLoggedIn(request)
    })

    it('missing pid', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          bid: 1,
          playerTid: 1,
          leagueId: 1
        })

      await missing(request, 'pid')
    })

    it('missing leagueId', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          bid: 1,
          playerTid: 1,
          pid: 'x'
        })

      await missing(request, 'leagueId')
    })

    it('missing playerTid', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          bid: 1,
          leagueId: 1,
          pid: 'x'
        })

      await missing(request, 'playerTid')
    })

    it('invalid bid - negative', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          bid: -1,
          playerTid: 1,
          pid: 'x',
          leagueId: 1
        })

      await invalid(request, 'bid')
    })

    it('invalid player - does not exist', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          bid: 1,
          playerTid: 1,
          pid: 'x',
          leagueId: 1
        })

      await invalid(request, 'player')
    })

    it('invalid release - not on team', async () => {
      const player = await selectPlayer()
      const exclude_pids = [player.pid]
      const releasePlayer = await selectPlayer({ exclude_pids })
      const leagueId = 1
      const teamId = 1
      const userId = 1
      const bid = 1

      await addPlayer({
        leagueId,
        player,
        teamId,
        userId
      })

      const request = chai_request
        .execute(server)
        .post(`/api/teams/${teamId}/tag/restricted-free-agency`)
        .set('Authorization', `Bearer ${user1}`)
        .send({
          bid,
          playerTid: teamId,
          pid: player.pid,
          release: releasePlayer.pid,
          leagueId
        })

      await invalid(request, 'release')
    })

    it('invalid leagueId - does not exist', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          bid: 1,
          playerTid: 1,
          pid: 'x',
          leagueId: 2
        })

      await invalid(request, 'leagueId')
    })

    it('teamId does not belong to userId', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          bid: 1,
          playerTid: 1,
          pid: 'x',
          leagueId: 1
        })

      await invalid(request, 'teamId')
    })

    it('player not on team', async () => {
      const player = await selectPlayer()
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          bid: 1,
          playerTid: 1,
          pid: player.pid,
          leagueId: 1
        })

      await invalid(request, 'player')
    })

    it('competing bid - non-existent original restricted free agency bid', async () => {
      const player = await selectPlayer()
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          bid: 1,
          playerTid: 2,
          pid: player.pid,
          leagueId: 1
        })

      await invalid(request, 'player')
    })

    it('competing bid - not enough roster space', async () => {
      const player = await selectPlayer()
      const originalTeamId = 2
      const competingTeamId = 1
      const leagueId = 1
      const bid = 1

      // add player to original team roster
      await addPlayer({
        leagueId,
        player,
        teamId: originalTeamId,
        userId: 2
      })

      // fill competing team roster
      await fillRoster({
        leagueId,
        teamId: competingTeamId,
        exclude_reserve_short_term: true,
        exclude_pids: [player.pid]
      })

      // original team bid
      const res1 = await chai_request
        .execute(server)
        .post(`/api/teams/${originalTeamId}/tag/restricted-free-agency`)
        .set('Authorization', `Bearer ${user2}`)
        .send({
          leagueId,
          bid,
          playerTid: originalTeamId,
          pid: player.pid
        })

      res1.should.have.status(200)

      // competing team bid
      const request = chai_request
        .execute(server)
        .post(`/api/teams/${competingTeamId}/tag/restricted-free-agency`)
        .set('Authorization', `Bearer ${user1}`)
        .send({
          bid,
          playerTid: originalTeamId,
          pid: player.pid,
          leagueId
        })

      await error(request, 'exceeds roster limits')
    })

    /* it('not enough cap space', async () => {
     *   const player = await selectPlayer()
     *   const exclude_pids = [player.pid]
     *   const tagPlayer = await selectPlayer({ exclude_pids })
     *   const leagueId = 1
     *   const userId = 1
     *   const teamId = 1
     *   const bid = 10
     *   const league = await getLeague({ lid: leagueId })

     *   await addPlayer({
     *     leagueId,
     *     player,
     *     teamId,
     *     userId,
     *     value: league.cap
     *   })

     *   await addPlayer({
     *     leagueId,
     *     player: tagPlayer,
     *     teamId,
     *     userId,
     *     value: 1
     *   })

     *   const request = chai
     *     .chai_request.execute(server)
     *     .post(`/api/teams/${teamId}/tag/restricted-free-agency`)
     *     .set('Authorization', `Bearer ${user1}`)
     *     .send({
     *       bid,
     *       playerTid: teamId,
     *       pid: tagPlayer.pid,
     *       leagueId
     *     })

     *   await error(request, 'exceeds salary cap')
     * }) */

    /* it('not enough cap space with cutlist', async () => {
     *   const exclude_pids = []
     *   const player = await selectPlayer()
     *   exclude_pids.push(player.pid)
     *   const tagPlayer = await selectPlayer({ exclude_pids })
     *   exclude_pids.push(tagPlayer.pid)
     *   const cutlistPlayer = await selectPlayer({ exclude_pids })
     *   const leagueId = 1
     *   const userId = 1
     *   const teamId = 1
     *   const bid = 10
     *   const cutlistPlayerValue = 10
     *   const league = await getLeague({ lid: leagueId })

     *   await addPlayer({
     *     leagueId,
     *     player,
     *     teamId,
     *     userId,
     *     value: league.cap + cutlistPlayerValue
     *   })

     *   await addPlayer({
     *     leagueId,
     *     player: cutlistPlayer,
     *     teamId,
     *     userId,
     *     value: cutlistPlayerValue
     *   })

     *   await addPlayer({
     *     leagueId,
     *     player: tagPlayer,
     *     teamId,
     *     userId,
     *     value: 1
     *   })

     *   const res1 = await chai
     *     .chai_request.execute(server)
     *     .post('/api/teams/1/cutlist')
     *     .set('Authorization', `Bearer ${user1}`)
     *     .send({
     *       leagueId,
     *       pids: cutlistPlayer.pid
     *     })

     *   res1.should.have.status(200)

     *   const request = chai
     *     .chai_request.execute(server)
     *     .post(`/api/teams/${teamId}/tag/restricted-free-agency`)
     *     .set('Authorization', `Bearer ${user1}`)
     *     .send({
     *       bid,
     *       playerTid: teamId,
     *       pid: tagPlayer.pid,
     *       leagueId
     *     })

     *   await error(request, 'exceeds salary cap')
     * }) */

    /* it('not enough cap space with release', async () => {
     *   const exclude_pids = []
     *   const player = await selectPlayer()
     *   exclude_pids.push(player.pid)
     *   const tagPlayer = await selectPlayer({ exclude_pids })
     *   exclude_pids.push(tagPlayer.pid)
     *   const releasePlayer = await selectPlayer({ exclude_pids })
     *   const leagueId = 1
     *   const userId = 1
     *   const teamId = 1
     *   const bid = 10
     *   const releasePlayerValue = 10
     *   const league = await getLeague({ lid: leagueId })

     *   await addPlayer({
     *     leagueId,
     *     player,
     *     teamId,
     *     userId,
     *     value: league.cap + releasePlayerValue
     *   })

     *   await addPlayer({
     *     leagueId,
     *     player: releasePlayer,
     *     teamId,
     *     userId,
     *     value: releasePlayerValue
     *   })

     *   await addPlayer({
     *     leagueId,
     *     player: tagPlayer,
     *     teamId,
     *     userId,
     *     value: 1
     *   })

     *   const request = chai
     *     .chai_request.execute(server)
     *     .post(`/api/teams/${teamId}/tag/restricted-free-agency`)
     *     .set('Authorization', `Bearer ${user1}`)
     *     .send({
     *       bid,
     *       playerTid: teamId,
     *       pid: tagPlayer.pid,
     *       release: releasePlayer.pid,
     *       leagueId
     *     })

     *   await error(request, 'exceeds salary cap')
     * })
     *
     * it('reserve violation', async () => {
     *   const leagueId = 1
     *   const teamId = 1
     *   const userId = 1
     *   const bid = 10
     *   const player = await selectPlayer()
     *   const reservePlayer = await selectPlayer({
     *     nfl_status: player_nfl_status.ACTIVE
     *   })

     *   await addPlayer({
     *     leagueId,
     *     player,
     *     teamId,
     *     userId
     *   })

     *   await addPlayer({
     *     leagueId,
     *     player: reservePlayer,
     *     teamId,
     *     userId,
     *     slot: roster_slot_types.RESERVE_SHORT_TERM
     *   })

     *   const request = chai
     *     .chai_request.execute(server)
     *     .post(`/api/teams/${teamId}/tag/restricted-free-agency`)
     *     .set('Authorization', `Bearer ${user1}`)
     *     .send({
     *       bid,
     *       playerTid: teamId,
     *       pid: player.pid,
     *       leagueId
     *     })

     *   await error(request, 'Reserve player violation')
     * })
     */
    it('invalid remove - not on team', async () => {
      // TODO
    })

    it('original bid - deadline passed', async () => {
      // TODO
    })

    it('competing bid - deadline passed', async () => {
      // TODO
    })

    it('exceeds tag limit', async () => {
      // TODO
    })

    it('invalid remove - matches player', async () => {
      // TODO
    })

    it('invalid release - includes player', async () => {
      // TODO
    })

    it('creating a RFA bid for your own player after RFA period has ended', async () => {
      const player = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const bid = 1

      await addPlayer({
        leagueId,
        player,
        teamId,
        userId
      })

      // Set RFA period end to yesterday
      await knex('seasons')
        .where({ lid: leagueId, year: current_season.year })
        .update({
          tran_end: Math.floor(Date.now() / 1000) - 86400
        })

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          bid,
          playerTid: teamId,
          pid: player.pid
        })

      await error(request, 'restricted free agency deadline has passed')
    })

    it('deleting an RFA bid after its been processed', async () => {
      const player = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const bid = 1

      await addPlayer({
        leagueId,
        player,
        teamId,
        userId
      })

      // Create initial RFA bid
      const res1 = await chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          bid,
          playerTid: teamId,
          pid: player.pid
        })

      res1.should.have.status(200)

      // Simulate processing the bid
      await knex('restricted_free_agency_bids')
        .where({ pid: player.pid })
        .update({ processed: Math.floor(Date.now() / 1000) })

      // Attempt to delete the processed bid
      const request = chai_request
        .execute(server)
        .delete('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          pid: player.pid
        })

      await error(request, 'bid has already been processed')
    })

    it('deleting an RFA bid after its been announced', async () => {
      const player = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const bid = 1

      await addPlayer({
        leagueId,
        player,
        teamId,
        userId
      })

      // Create initial RFA bid
      const res1 = await chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          bid,
          playerTid: teamId,
          pid: player.pid
        })

      res1.should.have.status(200)

      // Simulate announcing the bid
      await knex('restricted_free_agency_bids')
        .where({ pid: player.pid })
        .update({ announced: Math.floor(Date.now() / 1000) })

      // Attempt to delete the announced bid
      const request = chai_request
        .execute(server)
        .delete('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          pid: player.pid
        })

      await error(request, 'restricted free agent has already been announced')
    })

    it('updating an RFA bid after its been processed', async () => {
      const player = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const bid = 1

      await addPlayer({
        leagueId,
        player,
        teamId,
        userId
      })

      // Create initial RFA bid
      const res1 = await chai_request
        .execute(server)
        .post('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          bid,
          playerTid: teamId,
          pid: player.pid
        })

      res1.should.have.status(200)

      // Simulate processing the bid
      await knex('restricted_free_agency_bids')
        .where({ pid: player.pid })
        .update({ processed: Math.floor(Date.now() / 1000) })

      // Attempt to update the processed bid
      const request = chai_request
        .execute(server)
        .put('/api/teams/1/tag/restricted-free-agency')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          bid: bid + 1,
          pid: player.pid
        })

      await error(request, 'bid has already been processed')
    })

    // TODO - delete extension deadline passed

    // TODO - can't cancel original bid after during restricted free agency
  })
})
