/* global describe, before it */
process.env.NODE_ENV = 'test'

const chai = require('chai')
const chaiHTTP = require('chai-http')
const server = require('../api')
const knex = require('../db')

const league = require('../db/seeds/league')
const draft = require('../db/seeds/draft')
const { constants } = require('../common')

const should = chai.should()

const { user1, user2 } = require('./fixtures/token')

chai.use(chaiHTTP)

describe('API /trades', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()

    await league(knex)
    await draft(knex)
  })

  it('one-for-one player trade', async () => {
    const proposingTeamPlayerRows = await knex('rosters_players')
      .leftJoin('rosters', 'rosters_players.rid', 'rosters.uid')
      .where('rosters.tid', 1)
      .limit(1)

    const acceptingTeamPlayerRows = await knex('rosters_players')
      .leftJoin('rosters', 'rosters_players.rid', 'rosters.uid')
      .where('rosters.tid', 2)
      .limit(1)

    const proposingTeamPlayers = proposingTeamPlayerRows.map(p => p.player)
    const acceptingTeamPlayers = acceptingTeamPlayerRows.map(p => p.player)
    const proposeRes = await chai.request(server)
      .post('/api/leagues/1/trades')
      .set('Authorization', `Bearer ${user1}`)
      .send({
        proposingTeamPlayers,
        acceptingTeamPlayers,
        pid: 1,
        tid: 2,
        leagueId: 1
      })

    proposeRes.should.have.status(200)
    // eslint-disable-next-line
    proposeRes.should.be.json
    proposeRes.body.pid.should.be.equal(1)
    proposeRes.body.tid.should.be.equal(2)
    proposeRes.body.userid.should.be.equal(1)
    proposeRes.body.year.should.be.equal(constants.season.year)
    should.exist(proposeRes.body.offered)
    should.not.exist(proposeRes.body.cancelled)
    should.not.exist(proposeRes.body.accepted)
    should.not.exist(proposeRes.body.rejected)
    should.not.exist(proposeRes.body.vetoed)
    proposeRes.body.proposingTeamPlayers.should.be.eql(proposingTeamPlayers)
    proposeRes.body.acceptingTeamPlayers.should.be.eql(acceptingTeamPlayers)

    const tradeid = proposeRes.body.uid

    const acceptRes = await chai.request(server)
      .post(`/api/leagues/1/trades/${tradeid}/accept`)
      .set('Authorization', `Bearer ${user2}`)

    acceptRes.should.have.status(200)
    // eslint-disable-next-line
    acceptRes.should.be.json
    acceptRes.body.pid.should.be.equal(1)
    acceptRes.body.tid.should.be.equal(2)
    acceptRes.body.userid.should.be.equal(1)
    acceptRes.body.year.should.be.equal(constants.season.year)
    should.exist(acceptRes.body.offered)
    should.not.exist(acceptRes.body.cancelled)
    should.exist(acceptRes.body.accepted)
    should.not.exist(acceptRes.body.rejected)
    should.not.exist(acceptRes.body.vetoed)
    acceptRes.body.proposingTeamPlayers.should.be.eql(proposingTeamPlayers)
    acceptRes.body.acceptingTeamPlayers.should.be.eql(acceptingTeamPlayers)

    const rows = await knex('rosters_players')
      .leftJoin('rosters', 'rosters_players.rid', 'rosters.uid')
      .whereIn('rosters_players.player', proposingTeamPlayers.concat(acceptingTeamPlayers))

    rows.length.should.equal(2)
    const proposingRow = rows.find(p => p.tid === 1)
    const acceptingRow = rows.find(p => p.tid === 2)
    proposingRow.player.should.equal(acceptingTeamPlayers[0])
    acceptingRow.player.should.equal(proposingTeamPlayers[0])
  })
  // one for one trade

  // two for one trade with drop

  // one for two trade with drop

  // one for one pick exchange

  // two for one pick exchange

  // two players for two picks and two drops

  // three for one with no drop (has room)

  // cancel trade
  // reject trade

  // errors

  // - not logged in
  // - invalid userId
  // - invalid leagueId
  // - invalid teamId
  // - invalid player
  // - invalid drop
  // - teamId doesn't belong to userId
  // - drop player not on team
  // - player not on team
  // - some players not on team
  // - some drop players not on team
  // - pick not owned by proposing team
  // - some picks not owned by proposing team
  // - pick is not owned by accepting team
  // - some picks are not owned by accepting team
  // - pick already used/drafted
  // - exceeds bench space on proposing team
  // - exceeds available cap on proposing team
  // - exceeds bench space on accepting team
  // - exceeds available cap on accepting team
  // - trade player with existing poaching claim

  // - accept cancelled trade
  // - accept rejected trade
  // - reject rejected trade
  // - reject cancelled trade
})
