/* global describe it */

import * as chai from 'chai'
import {
  get_espn_api_key,
  get_espn_cookies,
  get_espn_leagues
} from '#league-import/espn.mjs'

const should = chai.should()
const expect = chai.expect

describe('IMPORTER ESPN', function () {
  this.timeout(60 * 1000)

  it('get api key', async () => {
    const apiKey = await get_espn_api_key()
    should.exist(apiKey)
  })

  it('get cookies', async () => {
    const { s2, swid } = await get_espn_cookies({
      username: 'teflonleague@gmail.com',
      password: 'meTaAGHSr8vZma6'
    })
    should.exist(s2)
    should.exist(swid)
  })

  it('get list of leagues', async () => {
    const leagues = await get_espn_leagues({
      username: 'teflonleague@gmail.com',
      password: 'meTaAGHSr8vZma6'
    })

    expect(leagues).to.be.an('array')
    expect(leagues).to.have.lengthOf(2)
    expect(leagues[0].name).to.equal('National Fantasy Team')
    expect(leagues[0].leagueId).to.equal(75466355)
  })
})
