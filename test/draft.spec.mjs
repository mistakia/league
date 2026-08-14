/* global describe before it after */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/fixtures/league.mjs'
import draftPicks from '#db/fixtures/draft-picks.mjs'
import { current_season, transaction_types } from '#constants'
import {
  selectPlayer,
  checkRoster,
  checkLastTransaction,
  notLoggedIn,
  missing,
  invalid,
  error
} from './utils/index.mjs'
import { user1, user2, user3 } from './fixtures/token.mjs'

chai.use(chai_http)
const { regular_season_start } = current_season
const expect = chai.expect

describe('API /draft', function () {
  before(async function () {
    this.timeout(60 * 1000)

    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())

    await knex.seed.run()

    await league(knex)
    await draftPicks(knex)
  })

  after(() => {
    MockDate.reset()
  })

  it('make selection', async () => {
    MockDate.set(
      regular_season_start
        .subtract('1', 'month')
        .add('10', 'minute')
        .toISOString()
    )

    const leagueId = 1
    const teamId = 1
    const player = await selectPlayer({ rookie: true })
    const res = await chai_request
      .execute(server)
      .post('/api/leagues/1/draft')
      .set('Authorization', `Bearer ${user1}`)
      .send({
        teamId,
        pid: player.pid,
        pickId: 1
      })

    res.should.have.status(200)

    res.should.be.json

    res.body.uid.should.equal(1)
    res.body.pid.should.equal(player.pid)
    res.body.lid.should.equal(leagueId)
    res.body.tid.should.equal(teamId)

    await checkRoster({ teamId, pid: player.pid, leagueId })
    await checkLastTransaction({
      leagueId,
      type: transaction_types.DRAFT,
      value: 12,
      year: current_season.year,
      pid: player.pid,
      teamId,
      userId: 1
    })

    const picks = await knex('draft').where({ uid: 1 })
    const pick = picks[0]

    expect(pick.pid).to.equal(player.pid)
  })

  // - draft a rookie with a traded pick
  // - draft a rookie after first 24hrs
  // - draft a rookie before the pick before you
  // - draft a rookie with no practice squad space (space on active roster)

  describe('errors', function () {
    it('not logged in', async () => {
      const request = chai_request.execute(server).post('/api/leagues/1/draft')
      await notLoggedIn(request)
    })

    it('missing teamId', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({ pid: 'xx', pickId: 1 })

      await missing(request, 'teamId')
    })

    it('missing pid', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({ teamId: 2, pickId: 1 })

      await missing(request, 'pid')
    })

    it('missing pickId', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({ pid: 'xx', teamId: 2 })

      await missing(request, 'pickId')
    })

    it('invalid teamId', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({ pid: 'xx', pickId: 2, teamId: 'a' })

      await invalid(request, 'teamId')
    })

    it('invalid pid - does not exist', async () => {
      MockDate.set(
        regular_season_start
          .subtract('1', 'month')
          .add('1', 'day')
          .toISOString()
      )
      const request = chai_request
        .execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({ pid: 'xx', pickId: 2, teamId: 2 })

      await invalid(request, 'pid')
    })

    it('invalid pid - position', async () => {
      // TODO
    })

    it('invalid leagueId', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/leagues/0/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({ pid: 'xx', pickId: 2, teamId: 2 })

      await invalid(request, 'leagueId')
    })

    it('invalid pid - not a rookie', async () => {
      const players = await knex('player')
        .where('nfl_draft_year', current_season.year - 1)
        .limit(1)
      const player = players[0]
      const request = chai_request
        .execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          pid: player.pid,
          pickId: 2
        })

      await invalid(request, 'pid')
    })

    it('teamId does not belong to userId', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user3}`)
        .send({ pid: 'xx', pickId: 2, teamId: 2 })

      await invalid(request, 'teamId')
    })

    it('draft hasnt started', async () => {
      MockDate.set(
        regular_season_start
          .subtract('1', 'month')
          .subtract('1', 'day')
          .toISOString()
      )
      const request = chai_request
        .execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          pid: 'xx',
          pickId: 2
        })

      await error(request, 'draft has not started')
    })

    it('pick not on clock', async () => {
      const player = await selectPlayer({ rookie: true })
      MockDate.set(
        regular_season_start
          .subtract('1', 'month')
          .add('1', 'minute')
          .toISOString()
      )
      const request = chai_request
        .execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user3}`)
        .send({
          teamId: 3,
          pid: player.pid,
          pickId: 3
        })

      await error(request, 'draft pick not on the clock')
    })

    it('jump blocked outside the daily window even after its window has opened', async () => {
      // Pick 1 was made by "make selection" at 00:10 7/25, so pick 3 is a real
      // jump (pick 2 unmade) whose window — reference pick 1 snapped to 11:00
      // 7/25, plus one hourly step — opened at 12:00 7/25. The clock is 00:00
      // 7/26, outside the default daily window [11,16): the jump must be
      // blocked even though its window moment has passed. Under the old code
      // (window passed ⇒ jumpable at any hour) this test failed.
      MockDate.set(
        regular_season_start
          .subtract('1', 'month')
          .add('1', 'day')
          .toISOString()
      )
      const request = chai_request
        .execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user3}`)
        .send({ teamId: 3, pid: 'xx', pickId: 3 })

      await error(request, 'draft pick not on the clock')
    })

    it('pick is already selected', async () => {
      MockDate.set(
        regular_season_start
          .subtract('1', 'month')
          .add('1', 'minute')
          .toISOString()
      )
      const request = chai_request
        .execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          pid: 'xx',
          pickId: 1
        })

      await invalid(request, 'pickId')
    })

    it('pickId does not belong to teamId', async () => {
      MockDate.set(
        regular_season_start
          .subtract('1', 'month')
          .add('1', 'minute')
          .toISOString()
      )
      const request = chai_request
        .execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          pid: 'xx',
          pickId: 2
        })

      await invalid(request, 'pickId')
    })

    it('player rostered', async () => {
      const picks = await knex('draft').where({ uid: 1 }).limit(1)
      const { pid } = picks[0]
      MockDate.set(
        regular_season_start
          .subtract('1', 'month')
          .add('2', 'day')
          .toISOString()
      )
      const request = chai_request
        .execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          pid,
          pickId: 2
        })

      await error(request, 'player rostered')
    })

    it('selection after draft has ended', async () => {
      MockDate.set(
        regular_season_start.add('1', 'month').add('1', 'day').toISOString()
      )
      const player = await selectPlayer({ rookie: true })
      const request = chai_request
        .execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          pid: player.pid,
          pickId: 2
        })

      await error(request, 'draft has ended')
    })

    // The pause guard is covered per route family in test/league-pause.spec.mjs,
    // but every request there carries an empty body and so would be refused
    // anyway — only the status code distinguishes a mounted guard from an
    // unmounted one. This drives a selection that is valid in every other
    // respect and asserts the same request answers 423 paused and 200 resumed,
    // which is the negative control the family sweep cannot give itself.
    it('league paused', async () => {
      MockDate.set(
        regular_season_start
          .subtract('1', 'month')
          .add('2', 'day')
          .toISOString()
      )
      // `make selection` above drafted a rookie onto team 1's week-0 roster, and
      // this is the only case in the file that expects a 200 — so an unexcluded
      // draw that collides with it answers `player rostered` on the RESUME leg
      // and reads as the pause guard having refused a request it never saw. The
      // pool is ~34 rookie RBs; measured at 11 failures in 250 runs before this.
      const drafted_pids = await knex('draft').whereNotNull('pid').pluck('pid')
      const player = await selectPlayer({
        rookie: true,
        exclude_pids: drafted_pids
      })
      const make_request = () =>
        chai_request
          .execute(server)
          .post('/api/leagues/1/draft')
          .set('Authorization', `Bearer ${user2}`)
          .send({
            teamId: 2,
            pid: player.pid,
            pickId: 2
          })

      await knex('league_pauses').insert({
        league_id: 1,
        paused_at: new Date(),
        pause_reason: 'commissioner review',
        paused_by_user_id: 1
      })

      const paused_res = await make_request()
      paused_res.should.have.status(423)
      paused_res.body.error.should.equal('league is paused')

      const [pick_while_paused] = await knex('draft').where({ uid: 2 })
      expect(pick_while_paused.pid).to.equal(null)

      await knex('league_pauses').del()

      const resumed_res = await make_request()
      resumed_res.should.have.status(200)
      resumed_res.body.pid.should.equal(player.pid)
    })

    it('exceeds roster limit', async () => {
      // TODO
    })

    it('exceeds roster cap', async () => {
      // TODO
    })

    it('pick expired', async () => {
      // TODO
    })

    it('reserve violation', async () => {
      // TODO
    })
  })
})
