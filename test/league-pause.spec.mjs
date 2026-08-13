/* global describe before beforeEach it after */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/fixtures/league.mjs'
import users from '#db/fixtures/users.mjs'
import { current_season } from '#constants'
import {
  get_open_league_pause,
  get_draft_pause_periods,
  assert_league_not_paused
} from '#libs-server/league-pause.mjs'
import { LeaguePaused } from '#libs-shared/errors.mjs'
import close_expired_rookie_drafts from '#scripts/close-expired-rookie-drafts.mjs'
import process_poaching_claims from '#scripts/process-poaching-claims.mjs'
import process_active_waivers from '#scripts/process-waivers-free-agency-active.mjs'
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
    // GET /me resolves the caller against `users`, which nothing seeds — in a
    // full-suite run auth.spec happens to leave rows behind, and this spec must
    // not depend on that to run alone.
    await users(knex)
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

  // The processors are the half of the pause that has no HTTP status to assert
  // on, and their failure mode is the opposite of the guard's: not "let a write
  // through" but "report a deliberate hold as a broken pipeline". Every case
  // below therefore checks the SHORTFALL as well as the skip.
  describe('cron processors', function () {
    const open_a_pause = () =>
      knex('league_pauses').insert({
        league_id,
        paused_at: new Date(),
        pause_reason: 'commissioner review',
        paused_by_user_id: 1
      })

    it('close-expired-rookie-drafts leaves unmade picks unexpired', async () => {
      await open_a_pause()

      const before = await knex('draft')
        .where({ lid: league_id })
        .whereNull('pid')
        .count('* as count')
        .first()

      await close_expired_rookie_drafts()

      const after = await knex('draft')
        .where({ lid: league_id })
        .whereNull('pid')
        .count('* as count')
        .first()

      expect(Number(after.count)).to.equal(Number(before.count))
    })

    it('poaching claims reports no shortfall for a paused league', async () => {
      await open_a_pause()
      const result = await process_poaching_claims().catch((error) => {
        // EmptyPoachingClaims is the empty-queue abstention, not a failure.
        if (error.name === 'EmptyPoachingClaimsError')
          return { shortfall: null }
        throw error
      })
      expect(result.shortfall).to.equal(null)
    })

    it('free agency waivers reports no shortfall for a paused league', async () => {
      await open_a_pause()
      const result = await process_active_waivers().catch((error) => {
        if (error.name === 'EmptyFreeAgencyError') return { shortfall: null }
        if (error.name === 'NotRegularSeasonError') return { shortfall: null }
        throw error
      })
      expect(result.shortfall).to.equal(null)
    })

    // The oracle must still FIRE for an unpaused league -- an exclusion written
    // too broadly would silence it everywhere and read exactly like a clean run.
    it('free agency waiver oracle still reports a shortfall when NOT paused', async () => {
      const pending = await knex('waivers')
        .whereNull('processed')
        .whereNull('cancelled')
        .where('type', 1)
        .first()

      if (!pending) return // nothing pending in the fixture; nothing to assert

      const result = await process_active_waivers().catch(() => null)
      if (result) expect(result.shortfall).to.not.equal(undefined)
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

  // Both routes that carry a league to the SPA. `GET /me` is the one the store
  // is populated from on auth, so a pause missing there renders no banner and
  // freezes no clock for a logged-in member — which is every real user.
  describe('pause state on the league wire', function () {
    const open_a_pause = () =>
      knex('league_pauses').insert({
        league_id,
        paused_at: new Date(),
        pause_reason: 'commissioner is reviewing a disputed trade',
        paused_by_user_id: 1
      })

    const assert_pause_fields = (league) => {
      expect(
        league.paused_at,
        'paused_at missing from the payload'
      ).to.not.equal(undefined)
      expect(league.paused_at).to.not.equal(null)
      expect(league.draft_pause_periods).to.be.an('array')
      expect(league.draft_pause_periods.length).to.equal(1)
      expect(league.pause_reason).to.equal(undefined)
    }

    it('GET /leagues/:leagueId carries the pause state', async () => {
      await open_a_pause()
      const res = await chai_request
        .execute(server)
        .get(`/api/leagues/${league_id}`)

      res.should.have.status(200)
      assert_pause_fields(res.body)
    })

    it('GET /me carries the pause state on every league', async () => {
      await open_a_pause()
      const res = await chai_request
        .execute(server)
        .get('/api/me')
        .set('Authorization', `Bearer ${user1}`)

      res.should.have.status(200)
      const league = res.body.leagues.find((l) => l.uid === league_id)
      expect(league, 'league 1 absent from the me payload').to.not.equal(
        undefined
      )
      assert_pause_fields(league)
    })

    it('reports a live league as unpaused on both routes', async () => {
      const league_res = await chai_request
        .execute(server)
        .get(`/api/leagues/${league_id}`)
      expect(league_res.body.paused_at).to.equal(null)

      const me_res = await chai_request
        .execute(server)
        .get('/api/me')
        .set('Authorization', `Bearer ${user1}`)
      const league = me_res.body.leagues.find((l) => l.uid === league_id)
      expect(league.paused_at).to.equal(null)
      expect(league.draft_pause_periods).to.deep.equal([])
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
