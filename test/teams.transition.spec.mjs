/* global describe before beforeEach it */
import chai from 'chai'
import chaiHTTP from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/seeds/league.mjs'
import { getRoster, getLeague } from '#utils'
import { constants } from '#common'
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
chai.use(chaiHTTP)
const expect = chai.expect
const { start } = constants.season

describe('API /teams - transition', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()

    MockDate.set(start.subtract('1', 'month').toISOString())

    await knex.seed.run()
  })

  describe('post', function () {
    beforeEach(async function () {
      await league(knex)
    })

    it('original team', async () => {
      MockDate.set(start.subtract('2', 'month').toISOString())

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

      const res = await chai
        .request(server)
        .post('/api/teams/1/tag/transition')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          bid,
          playerTid: teamId,
          release: [releasePlayer.pid],
          pid: player.pid
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.userid.should.equal(userId)
      res.body.pid.should.equal(player.pid)
      res.body.submitted.should.equal(Math.round(Date.now() / 1000))
      res.body.bid.should.equal(bid)
      res.body.year.should.equal(constants.season.year)
      res.body.player_tid.should.equal(teamId)
      res.body.uid.should.equal(1)
      res.body.release.length.should.equal(1)
      res.body.release[0].should.equal(releasePlayer.pid)

      const query1 = await knex('transition_bids').select()

      query1.length.should.equal(1)
      query1[0].uid.should.equal(1)
      query1[0].pid.should.equal(player.pid)
      query1[0].userid.should.equal(userId)
      query1[0].bid.should.equal(bid)
      query1[0].year.should.equal(constants.season.year)
      query1[0].tid.should.equal(teamId)
      query1[0].player_tid.should.equal(teamId)
      query1[0].lid.should.equal(leagueId)
      expect(query1[0].succ).to.equal(null)
      expect(query1[0].reason).to.equal(null)
      expect(query1[0].submitted).to.equal(Math.round(Date.now() / 1000))
      expect(query1[0].processed).to.equal(null)
      expect(query1[0].cancelled).to.equal(null)

      const query2 = await knex('transition_releases').select()

      query2.length.should.equal(1)
      query2[0].transitionid.should.equal(1)
      query2[0].pid.should.equal(releasePlayer.pid)

      const roster = await getRoster({ tid: teamId })

      const taggedPlayer = roster.players.find((p) => p.pid === player.pid)
      taggedPlayer.tag.should.equal(constants.tags.TRANSITION)
    })

    it('competing team', async () => {
      MockDate.set(start.subtract('2', 'month').toISOString())

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

      const res1 = await chai
        .request(server)
        .post('/api/teams/2/tag/transition')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          leagueId,
          bid: 1,
          playerTid,
          pid: player.pid
        })

      res1.should.have.status(200)

      const res2 = await chai
        .request(server)
        .post('/api/teams/1/tag/transition')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          bid,
          playerTid,
          pid: player.pid
        })

      res2.should.have.status(200)
      // eslint-disable-next-line
      res2.should.be.json

      res2.body.tid.should.equal(1)
      res2.body.userid.should.equal(userId)
      res2.body.pid.should.equal(player.pid)
      res2.body.year.should.equal(constants.season.year)
      res2.body.submitted.should.equal(Math.round(Date.now() / 1000))
      res2.body.bid.should.equal(bid)
      res2.body.player_tid.should.equal(playerTid)
      res2.body.release.length.should.equal(0)
    })

    it('original team with cutlist and release, salary cap check', async () => {
      MockDate.set(start.subtract('2', 'month').toISOString())

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

      await fillRoster({ leagueId, teamId, excludeIR: true, exclude_pids })

      const res1 = await chai
        .request(server)
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          pids: cutlistPlayer.pid
        })

      res1.should.have.status(200)

      const res2 = await chai
        .request(server)
        .post('/api/teams/1/tag/transition')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId,
          bid,
          playerTid: teamId,
          pid: tagPlayer.pid,
          release: releasePlayer.pid
        })

      res2.should.have.status(200)
      // eslint-disable-next-line
      res2.should.be.json

      res2.body.tid.should.equal(teamId)
      res2.body.userid.should.equal(userId)
      res2.body.year.should.equal(constants.season.year)
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
  })

  describe('errors', function () {
    beforeEach(async function () {
      await league(knex)
    })

    it('not logged in', async () => {
      const request = chai.request(server).post('/api/teams/1/tag/transition')
      await notLoggedIn(request)
    })

    it('missing pid', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/tag/transition')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          bid: 1,
          playerTid: 1,
          leagueId: 1
        })

      await missing(request, 'pid')
    })

    it('missing bid', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/tag/transition')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: 'x',
          playerTid: 1,
          leagueId: 1
        })

      await missing(request, 'bid')
    })

    it('missing leagueId', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/tag/transition')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          bid: 1,
          playerTid: 1,
          pid: 'x'
        })

      await missing(request, 'leagueId')
    })

    it('missing playerTid', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/tag/transition')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          bid: 1,
          leagueId: 1,
          pid: 'x'
        })

      await missing(request, 'playerTid')
    })

    it('invalid bid - negative', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/tag/transition')
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
      const request = chai
        .request(server)
        .post('/api/teams/1/tag/transition')
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

      const request = chai
        .request(server)
        .post(`/api/teams/${teamId}/tag/transition`)
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
      const request = chai
        .request(server)
        .post('/api/teams/1/tag/transition')
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
      const request = chai
        .request(server)
        .post('/api/teams/1/tag/transition')
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
      const request = chai
        .request(server)
        .post('/api/teams/1/tag/transition')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          bid: 1,
          playerTid: 1,
          pid: player.pid,
          leagueId: 1
        })

      await invalid(request, 'player')
    })

    it('competing bid - non-existent original transition bid', async () => {
      const player = await selectPlayer()
      const request = chai
        .request(server)
        .post('/api/teams/1/tag/transition')
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
        excludeIR: true,
        exclude_pids: [player.pid]
      })

      // original team bid
      const res1 = await chai
        .request(server)
        .post(`/api/teams/${originalTeamId}/tag/transition`)
        .set('Authorization', `Bearer ${user2}`)
        .send({
          leagueId,
          bid,
          playerTid: originalTeamId,
          pid: player.pid
        })

      res1.should.have.status(200)

      // competing team bid
      const request = chai
        .request(server)
        .post(`/api/teams/${competingTeamId}/tag/transition`)
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
     *     .request(server)
     *     .post(`/api/teams/${teamId}/tag/transition`)
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
     *     .request(server)
     *     .post('/api/teams/1/cutlist')
     *     .set('Authorization', `Bearer ${user1}`)
     *     .send({
     *       leagueId,
     *       pids: cutlistPlayer.pid
     *     })

     *   res1.should.have.status(200)

     *   const request = chai
     *     .request(server)
     *     .post(`/api/teams/${teamId}/tag/transition`)
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
     *     .request(server)
     *     .post(`/api/teams/${teamId}/tag/transition`)
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
     *   const reservePlayer = await selectPlayer()

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
     *     slot: constants.slots.IR
     *   })

     *   const request = chai
     *     .request(server)
     *     .post(`/api/teams/${teamId}/tag/transition`)
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

    // TODO - delete extension deadline passed

    // TODO - can't cancel original bid after during restricted free agency
  })
})
