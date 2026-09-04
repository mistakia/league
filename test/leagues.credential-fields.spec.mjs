/* global describe before it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'

import server from '#api'
import knex from '#db'
import { getLeague } from '#libs-server'
import { current_season } from '#constants'

import league from '#db/fixtures/league.mjs'
import { user1 } from './fixtures/token.mjs'
import { league_credential_fields } from '#api/routes/leagues/middleware.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect
chai.should()
chai.use(chai_http)

// A Discord webhook URL is a bearer credential -- holding the URL is the whole
// permission -- and both of these were served to anonymous callers until
// 2026-09-04, because `/api/leagues` mounts above the blanket 401 and the route
// sent the whole `leagues` row. These values are placeholders on a test
// database and are never real.
const test_webhook_url = 'https://discord.example/webhooks/test-notifications'
const test_announcements_webhook_url =
  'https://discord.example/webhooks/test-announcements'

describe('API /leagues - credential fields', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
    await league(knex)

    await knex('leagues').where({ league_id: 1 }).update({
      discord_webhook_url: test_webhook_url,
      discord_announcements_webhook_url: test_announcements_webhook_url
    })
  })

  it('the fixture actually carries both credentials', async () => {
    // The negative control. Without it every assertion below passes on a league
    // that simply has no webhooks configured, which is indistinguishable from a
    // working filter and is the direction that looks like success.
    const league_row = await getLeague({ lid: 1 })

    expect(league_row.discord_webhook_url).to.equal(test_webhook_url)
    expect(league_row.discord_announcements_webhook_url).to.equal(
      test_announcements_webhook_url
    )
  })

  it('GET /leagues/:leagueId omits them for an anonymous caller', async () => {
    const res = await chai_request.execute(server).get('/api/leagues/1')

    res.should.have.status(200)
    res.should.be.json

    // Assert on key ABSENCE, not on the value. A route that sent `null` would
    // satisfy a value comparison while still telling an anonymous caller
    // whether a webhook is configured.
    for (const field of league_credential_fields) {
      expect(res.body).to.not.have.property(field)
    }

    // The response is otherwise intact -- this proves the filter removed two
    // keys rather than emptying the body.
    expect(res.body.league_id).to.equal(1)
    expect(res.body.name).to.be.a('string')
  })

  it('GET /leagues/:leagueId omits them for an authenticated caller', async () => {
    // Nothing in the SPA reads either column, so there is no audience for them
    // on any session -- the commissioner sets a webhook through PUT and never
    // reads it back.
    const res = await chai_request
      .execute(server)
      .get('/api/leagues/1')
      .set('Authorization', `Bearer ${user1}`)

    res.should.have.status(200)

    for (const field of league_credential_fields) {
      expect(res.body).to.not.have.property(field)
    }
  })

  it('GET /leagues/:leagueId/seasons/:year omits them', async () => {
    const res = await chai_request
      .execute(server)
      .get(`/api/leagues/1/seasons/${current_season.year}`)

    res.should.have.status(200)

    for (const field of league_credential_fields) {
      expect(res.body).to.not.have.property(field)
    }
  })

  it('leaves the stored values alone', async () => {
    // The server-side senders read these columns to post to Discord
    // (libs-server/send-notifications.mjs, scripts/announce-draft-slate.mjs),
    // so the filter must be a response-shaping step and not a data change.
    const league_row = await knex('leagues').where({ league_id: 1 }).first()

    expect(league_row.discord_webhook_url).to.equal(test_webhook_url)
    expect(league_row.discord_announcements_webhook_url).to.equal(
      test_announcements_webhook_url
    )
  })
})
