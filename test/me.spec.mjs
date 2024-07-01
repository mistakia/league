/* global describe, before it */
import chai from 'chai'
import chaiHTTP from 'chai-http'

import server from '#api'
import knex from '#db'
import users from '#db/seeds/users.mjs'
import { user1 } from './fixtures/token.mjs'

process.env.NODE_ENV = 'test'
chai.use(chaiHTTP)
chai.should()

describe('API /me', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()

    await users(knex)
  })

  it('/api/me', async () => {
    const res = await chai
      .request(server)
      .get('/api/me')
      .set('Authorization', `Bearer ${user1}`)
    res.should.have.status(200)
    // eslint-disable-next-line
    res.should.be.json
    res.body.user.id.should.equal(1)
    res.body.user.email.should.equal('user1@email.com')
    res.body.teams.should.be.an('array')
    res.body.leagues.should.be.an('array')
    res.body.sources.should.be.an('array')
    res.body.poaches.should.be.an('array')
    res.body.waivers.should.be.an('array')
  })
})
