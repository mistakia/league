/* global describe before beforeEach it after */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season } from '#constants'
import {
  get_open_league_pause,
  get_draft_pause_periods,
  assert_league_not_paused
} from '#libs-server/league-pause.mjs'
import { LeaguePaused } from '#libs-shared/errors.mjs'
import { notLoggedIn, missing, forbidden } from './utils/index.mjs'
import { user1, user2 } from './fixtures/token.mjs'

chai.use(chai_http)
chai.should()
const { regular_season_start } = current_season
const expect = chai.expect

const league_id = 1

// user1 is league 1's commissioner in the league fixture; user2 is an ordinary
// member. The pause routes must separate them.
const pause_league = ({ token = user1, pause_reason = 'testing' } = {}) =>
  chai_request
    .execute(server)
    .post(`/api/leagues/${league_id}/pause`)
    .set('Authorization', `Bearer ${token}`)
    .send({ pause_reason })

const resume_league = ({ token = user1 } = {}) =>
  chai_request
    .execute(server)
    .delete(`/api/leagues/${league_id}/pause`)
    .set('Authorization', `Bearer ${token}`)

describe('LEAGUE PAUSE', function () {
  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
    await knex.seed.run()
    await league(knex)
  })

  beforeEach(async function () {
    await knex('league_pauses').del()
  })

  // Specs share one database in a single mocha process, so a pause row left
  // behind here answers 423 to every later spec's writes against this league.
  after(async () => {
    await knex('league_pauses').del()
    MockDate.reset()
  })

  describe('libs-server league-pause', function () {
    describe('get_open_league_pause', function () {
      it('returns null for a league that was never paused', async () => {
        const open_pause = await get_open_league_pause({ league_id, db: knex })
        expect(open_pause).to.equal(null)
      })

      it('returns the row for an open pause', async () => {
        await knex('league_pauses').insert({
          league_id,
          paused_at: new Date(),
          pause_reason: 'commissioner review',
          paused_by_user_id: 1
        })

        const open_pause = await get_open_league_pause({ league_id, db: knex })
        expect(open_pause).to.not.equal(null)
        expect(open_pause.pause_reason).to.equal('commissioner review')
      })

      it('returns null once the pause is resumed', async () => {
        await knex('league_pauses').insert({
          league_id,
          paused_at: new Date(Date.now() - 3600 * 1000),
          resumed_at: new Date(),
          pause_reason: 'over',
          paused_by_user_id: 1
        })

        const open_pause = await get_open_league_pause({ league_id, db: knex })
        expect(open_pause).to.equal(null)
      })

      it('does not read another league pause', async () => {
        await knex('league_pauses').insert({
          league_id: 2,
          paused_at: new Date(),
          pause_reason: 'other league',
          paused_by_user_id: 1
        })

        const open_pause = await get_open_league_pause({ league_id, db: knex })
        expect(open_pause).to.equal(null)
      })
    })

    describe('the one-open-pause invariant', function () {
      it('rejects a second open pause on the same league', async () => {
        await knex('league_pauses').insert({
          league_id,
          paused_at: new Date(),
          pause_reason: 'first',
          paused_by_user_id: 1
        })

        let insert_error = null
        try {
          await knex('league_pauses').insert({
            league_id,
            paused_at: new Date(),
            pause_reason: 'second',
            paused_by_user_id: 1
          })
        } catch (error) {
          insert_error = error
        }

        expect(insert_error).to.not.equal(null)
        expect(insert_error.constraint).to.equal(
          'league_pauses_one_open_per_league'
        )
      })

      it('allows a new pause after the previous one resumed', async () => {
        await knex('league_pauses').insert({
          league_id,
          paused_at: new Date(Date.now() - 3600 * 1000),
          resumed_at: new Date(),
          pause_reason: 'first',
          paused_by_user_id: 1
        })

        await knex('league_pauses').insert({
          league_id,
          paused_at: new Date(),
          pause_reason: 'second',
          paused_by_user_id: 1
        })

        const rows = await knex('league_pauses').where({ league_id })
        expect(rows.length).to.equal(2)
      })
    })

    describe('assert_league_not_paused', function () {
      it('resolves for a live league', async () => {
        await assert_league_not_paused({ league_id, db: knex })
      })

      it('throws LeaguePaused for a paused league', async () => {
        await knex('league_pauses').insert({
          league_id,
          paused_at: new Date(),
          pause_reason: 'held',
          paused_by_user_id: 1
        })

        let thrown = null
        try {
          await assert_league_not_paused({ league_id, db: knex })
        } catch (error) {
          thrown = error
        }

        expect(thrown).to.be.instanceof(LeaguePaused)
        expect(thrown.name).to.equal('LeaguePausedError')
      })
    })

    describe('get_draft_pause_periods', function () {
      const draft_start = new Date('2026-08-10T15:00:00Z')

      it('returns nothing when the league was never paused', async () => {
        const periods = await get_draft_pause_periods({
          league_id,
          draft_start,
          db: knex
        })
        expect(periods.length).to.equal(0)
      })

      it('drops an interval that closed before the draft opened', async () => {
        await knex('league_pauses').insert({
          league_id,
          paused_at: new Date('2026-08-01T12:00:00Z'),
          resumed_at: new Date('2026-08-02T12:00:00Z'),
          pause_reason: 'before the draft',
          paused_by_user_id: 1
        })

        const periods = await get_draft_pause_periods({
          league_id,
          draft_start,
          db: knex
        })
        expect(periods.length).to.equal(0)
      })

      it('keeps an open interval and leaves resumed_at null', async () => {
        await knex('league_pauses').insert({
          league_id,
          paused_at: new Date('2026-08-12T12:00:00Z'),
          pause_reason: 'live pause',
          paused_by_user_id: 1
        })

        const periods = await get_draft_pause_periods({
          league_id,
          draft_start,
          db: knex
        })
        expect(periods.length).to.equal(1)
        expect(periods[0].resumed_at).to.equal(null)
      })
    })
  })

  describe('API /leagues/:leagueId/pause', function () {
    it('requires authentication', async () => {
      await notLoggedIn(
        chai_request
          .execute(server)
          .post(`/api/leagues/${league_id}/pause`)
          .send({ pause_reason: 'testing' })
      )
    })

    it('requires a pause_reason', async () => {
      await missing(pause_league({ pause_reason: '' }), 'pause_reason')
    })

    it('refuses a non-commissioner', async () => {
      await forbidden(pause_league({ token: user2 }))
    })

    it('opens a pause for the commissioner', async () => {
      const res = await pause_league({ pause_reason: 'commissioner review' })
      res.should.have.status(200)
      res.body.league_id.should.equal(league_id)
      res.body.pause_reason.should.equal('commissioner review')
      expect(res.body.resumed_at).to.equal(null)
    })

    it('returns the open pause rather than opening a second', async () => {
      const first = await pause_league({ pause_reason: 'first' })
      const second = await pause_league({ pause_reason: 'second' })

      second.should.have.status(200)
      second.body.pause_id.should.equal(first.body.pause_id)
      second.body.pause_reason.should.equal('first')

      const rows = await knex('league_pauses').where({ league_id })
      expect(rows.length).to.equal(1)
    })

    it('resumes a paused league', async () => {
      await pause_league()
      const res = await resume_league()

      res.should.have.status(200)
      expect(res.body.resumed_at).to.not.equal(null)

      const open_pause = await get_open_league_pause({ league_id, db: knex })
      expect(open_pause).to.equal(null)
    })

    it('refuses to resume a league that is not paused', async () => {
      const res = await resume_league()
      res.should.have.status(400)
      res.body.error.should.equal('league is not paused')
    })

    it('refuses a non-commissioner resume', async () => {
      await pause_league()
      await forbidden(resume_league({ token: user2 }))
    })
  })

  describe('API pause guard', function () {
    const open_a_pause = () =>
      knex('league_pauses').insert({
        league_id,
        paused_at: new Date(),
        pause_reason: 'commissioner is reviewing a disputed trade',
        paused_by_user_id: 1
      })

    // One request per route family. The guard is mounted once per router, so a
    // family that answers 200 while another answers 423 means the mount is above
    // one set of routes and below the other.
    const mutating_requests = {
      'league settings PUT': () =>
        chai_request
          .execute(server)
          .put(`/api/leagues/${league_id}`)
          .set('Authorization', `Bearer ${user1}`)
          .send({ field: 'name', value: 'Renamed' }),
      trade: () =>
        chai_request
          .execute(server)
          .post(`/api/leagues/${league_id}/trades`)
          .set('Authorization', `Bearer ${user1}`)
          .send({}),
      waiver: () =>
        chai_request
          .execute(server)
          .post(`/api/leagues/${league_id}/waivers`)
          .set('Authorization', `Bearer ${user1}`)
          .send({}),
      draft: () =>
        chai_request
          .execute(server)
          .post(`/api/leagues/${league_id}/draft`)
          .set('Authorization', `Bearer ${user1}`)
          .send({}),
      poach: () =>
        chai_request
          .execute(server)
          .post(`/api/leagues/${league_id}/poaches`)
          .set('Authorization', `Bearer ${user1}`)
          .send({}),
      'team PUT via /api/teams': () =>
        chai_request
          .execute(server)
          .put('/api/teams/1')
          .set('Authorization', `Bearer ${user1}`)
          .send({ field: 'name', value: 'Renamed' }),
      'roster add via /api/teams': () =>
        chai_request
          .execute(server)
          .post('/api/teams/1/add')
          .set('Authorization', `Bearer ${user1}`)
          .send({})
    }

    for (const [family, make_request] of Object.entries(mutating_requests)) {
      it(`refuses ${family} with 423 while paused`, async () => {
        await open_a_pause()
        const res = await make_request()
        res.should.have.status(423)
        res.body.error.should.equal('league is paused')
      })
    }

    it('passes reads while paused', async () => {
      await open_a_pause()
      const res = await chai_request
        .execute(server)
        .get(`/api/leagues/${league_id}`)
      res.should.have.status(200)
    })

    // The guard runs pre-auth -- both routers mount above the blanket 401 -- so
    // an anonymous caller reaches it. It must disclose nothing beyond the bare
    // refusal.
    it('leaks neither pause_reason nor paused_at to an anonymous caller', async () => {
      await open_a_pause()
      const res = await chai_request
        .execute(server)
        .post(`/api/leagues/${league_id}/trades`)
        .send({})

      res.should.have.status(423)
      const body_text = JSON.stringify(res.body)
      expect(body_text).to.not.include('commissioner is reviewing')
      expect(body_text).to.not.include('paused_at')
      expect(Object.keys(res.body)).to.deep.equal(['error'])
    })

    // A guard that resolved no league id would pass every request and look
    // identical to a working guard on the happy path, so the negative direction
    // is asserted explicitly: unpaused must NOT 423.
    it('does not refuse when the league is live', async () => {
      const res = await mutating_requests.trade()
      expect(res.status).to.not.equal(423)
    })

    it('leaves the pause routes reachable while paused', async () => {
      await open_a_pause()
      const res = await resume_league()
      res.should.have.status(200)
    })

    it('does not refuse a write to a DIFFERENT league while this one is paused', async () => {
      await knex('league_pauses').insert({
        league_id: 2,
        paused_at: new Date(),
        pause_reason: 'other league',
        paused_by_user_id: 1
      })

      const res = await mutating_requests.trade()
      expect(res.status).to.not.equal(423)
    })
  })
})
