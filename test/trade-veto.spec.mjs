/* global describe before beforeEach afterEach it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/fixtures/league.mjs'
import draft from '#db/fixtures/draft.mjs'
import draft_picks from '#db/fixtures/draft-picks.mjs'
import {
  current_season,
  roster_slot_types,
  transaction_types
} from '#constants'
import { user1, user2 } from './fixtures/token.mjs'
import { error } from './utils/index.mjs'

process.env.NODE_ENV = 'test'

const should = chai.should()
chai.use(chai_http)

// user1 is the league fixture's commissioner (db/fixtures/league.mjs sets
// commishid to user 1) and owns team 1; user2 owns team 2.
// K and DST each have a single roster slot, so trading one to a team that
// already holds one fails position validation on accept. Without an ORDER BY
// the pick also depends on physical row order, which shifts whenever another
// spec file consumes a different number of players from the shared pool -- that
// combination made this helper fail intermittently on an unrelated change.
const get_roster_player = async ({ tid }) => {
  const rows = await knex('rosters_players')
    .where({
      lid: 1,
      tid,
      season_year: current_season.year,
      week: current_season.week
    })
    .whereNotIn('player_position', ['K', 'DST'])
    .orderBy('pid', 'asc')
    .limit(1)
  return rows[0]
}

const propose_and_accept_one_for_one = async () => {
  const proposing_row = await get_roster_player({ tid: 1 })
  const accepting_row = await get_roster_player({ tid: 2 })

  const proposingTeamPlayers = [proposing_row.pid]
  const acceptingTeamPlayers = [accepting_row.pid]

  await knex('transactions')
    .whereIn('pid', proposingTeamPlayers.concat(acceptingTeamPlayers))
    .update('player_salary', 0)

  const proposing_team_slots = {
    [acceptingTeamPlayers[0]]: roster_slot_types.BENCH
  }
  const accepting_team_slots = {
    [proposingTeamPlayers[0]]: roster_slot_types.BENCH
  }

  const propose_res = await chai_request
    .execute(server)
    .post('/api/leagues/1/trades')
    .set('Authorization', `Bearer ${user1}`)
    .send({
      proposingTeamPlayers,
      acceptingTeamPlayers,
      proposing_team_slots,
      accepting_team_slots,
      propose_tid: 1,
      accept_tid: 2,
      leagueId: 1
    })
  propose_res.should.have.status(200)

  const tradeid = propose_res.body.uid

  const accept_res = await chai_request
    .execute(server)
    .post(`/api/leagues/1/trades/${tradeid}/accept`)
    .set('Authorization', `Bearer ${user2}`)
  accept_res.should.have.status(200)

  return {
    tradeid,
    proposing_row,
    accepting_row,
    proposingTeamPlayers,
    acceptingTeamPlayers
  }
}

describe('API /trades - veto', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    await league(knex)
    await draft(knex)
  })

  afterEach(function () {
    MockDate.reset()
  })

  it('returns players to their original rosters', async () => {
    const { tradeid, proposing_row, accepting_row } =
      await propose_and_accept_one_for_one()

    // the accept moved each player to the other team
    const traded = await knex('rosters_players').whereIn('pid', [
      proposing_row.pid,
      accepting_row.pid
    ])
    traded.find((p) => p.pid === proposing_row.pid).tid.should.equal(2)
    traded.find((p) => p.pid === accepting_row.pid).tid.should.equal(1)

    const veto_res = await chai_request
      .execute(server)
      .post(`/api/leagues/1/trades/${tradeid}/veto`)
      .set('Authorization', `Bearer ${user1}`)
    veto_res.should.have.status(200)

    const restored = await knex('rosters_players').whereIn('pid', [
      proposing_row.pid,
      accepting_row.pid
    ])
    restored.length.should.equal(2)
    restored.find((p) => p.pid === proposing_row.pid).tid.should.equal(1)
    restored.find((p) => p.pid === accepting_row.pid).tid.should.equal(2)
  })

  it('restores each player to the slot they occupied before the trade', async () => {
    const { tradeid, proposing_row, accepting_row } =
      await propose_and_accept_one_for_one()

    const veto_res = await chai_request
      .execute(server)
      .post(`/api/leagues/1/trades/${tradeid}/veto`)
      .set('Authorization', `Bearer ${user1}`)
    veto_res.should.have.status(200)

    const restored = await knex('rosters_players').whereIn('pid', [
      proposing_row.pid,
      accepting_row.pid
    ])
    const restored_proposing = restored.find((p) => p.pid === proposing_row.pid)
    const restored_accepting = restored.find((p) => p.pid === accepting_row.pid)
    restored_proposing.tid.should.equal(1)
    restored_proposing.slot.should.equal(proposing_row.slot)
    restored_accepting.tid.should.equal(2)
    restored_accepting.slot.should.equal(accepting_row.slot)
  })

  it('returns traded picks to the team that gave them up', async () => {
    await draft_picks(knex)

    const pick_rows = await knex('draft')
      .where({ lid: 1, tid: 1, season_year: current_season.year + 1 })
      .whereNull('pid')
      .limit(1)
    const pick = pick_rows[0]
    should.exist(pick)

    const propose_res = await chai_request
      .execute(server)
      .post('/api/leagues/1/trades')
      .set('Authorization', `Bearer ${user1}`)
      .send({
        proposingTeamPlayers: [],
        acceptingTeamPlayers: [],
        proposingTeamPicks: [pick.uid],
        acceptingTeamPicks: [],
        propose_tid: 1,
        accept_tid: 2,
        leagueId: 1
      })
    propose_res.should.have.status(200)

    const accept_res = await chai_request
      .execute(server)
      .post(`/api/leagues/1/trades/${propose_res.body.uid}/accept`)
      .set('Authorization', `Bearer ${user2}`)
    accept_res.should.have.status(200)

    const after_accept = await knex('draft').where({ uid: pick.uid }).first()
    after_accept.tid.should.equal(2)

    const veto_res = await chai_request
      .execute(server)
      .post(`/api/leagues/1/trades/${propose_res.body.uid}/veto`)
      .set('Authorization', `Bearer ${user1}`)
    veto_res.should.have.status(200)

    const after_veto = await knex('draft').where({ uid: pick.uid }).first()
    after_veto.tid.should.equal(1)
  })

  it('keeps the trade in history as accepted and vetoed', async () => {
    const { tradeid } = await propose_and_accept_one_for_one()

    const veto_res = await chai_request
      .execute(server)
      .post(`/api/leagues/1/trades/${tradeid}/veto`)
      .set('Authorization', `Bearer ${user1}`)

    should.exist(veto_res.body.accepted)
    should.exist(veto_res.body.vetoed)

    const rows = await knex('trades').where({ uid: tradeid })
    rows.length.should.equal(1)
    should.exist(rows[0].accepted)
    should.exist(rows[0].vetoed)
  })

  it('appends reversing transactions rather than deleting the originals', async () => {
    const { tradeid, proposing_row, accepting_row } =
      await propose_and_accept_one_for_one()

    await chai_request
      .execute(server)
      .post(`/api/leagues/1/trades/${tradeid}/veto`)
      .set('Authorization', `Bearer ${user1}`)

    const pids = [proposing_row.pid, accepting_row.pid]

    const trade_transactions = await knex('transactions')
      .whereIn('pid', pids)
      .where({ type: transaction_types.TRADE, lid: 1 })
    trade_transactions.length.should.equal(2)

    const reversal_transactions = await knex('transactions')
      .whereIn('pid', pids)
      .where({ type: transaction_types.TRADE_REVERSAL, lid: 1 })
    reversal_transactions.length.should.equal(2)

    // each reversal credits the team that originally gave the player up
    reversal_transactions
      .find((t) => t.pid === proposing_row.pid)
      .tid.should.equal(1)
    reversal_transactions
      .find((t) => t.pid === accepting_row.pid)
      .tid.should.equal(2)
  })

  it('freezes a traded player against release during the veto window', async () => {
    const { proposing_row } = await propose_and_accept_one_for_one()

    // team 2 now holds the player and tries to cut them before the window closes
    const request = chai_request
      .execute(server)
      .post('/api/teams/2/release')
      .set('Authorization', `Bearer ${user2}`)
      .send({ pid: proposing_row.pid, teamId: 2, leagueId: 1 })

    const res = await request
    res.should.have.status(400)
    res.body.error.should.match(/veto window/)
  })

  it('allows a release once the veto window has closed', async function () {
    const { proposing_row } = await propose_and_accept_one_for_one()

    MockDate.set(Date.now() + 25 * 60 * 60 * 1000)

    const res = await chai_request
      .execute(server)
      .post('/api/teams/2/release')
      .set('Authorization', `Bearer ${user2}`)
      .send({ pid: proposing_row.pid, teamId: 2, leagueId: 1 })

    res.should.have.status(200)
  })

  it('refuses to reverse a trade after the veto window has closed', async () => {
    const { tradeid } = await propose_and_accept_one_for_one()

    MockDate.set(Date.now() + 25 * 60 * 60 * 1000)

    const request = chai_request
      .execute(server)
      .post(`/api/leagues/1/trades/${tradeid}/veto`)
      .set('Authorization', `Bearer ${user1}`)

    await error(
      request,
      'veto window has closed; this trade can no longer be reversed'
    )
  })

  it('rejects a veto from anyone but the commissioner', async () => {
    const { tradeid } = await propose_and_accept_one_for_one()

    const res = await chai_request
      .execute(server)
      .post(`/api/leagues/1/trades/${tradeid}/veto`)
      .set('Authorization', `Bearer ${user2}`)

    res.should.have.status(401)
    res.body.error.should.equal('only the commissioner can veto trades')
  })

  it('rejects a second veto of the same trade', async () => {
    const { tradeid } = await propose_and_accept_one_for_one()

    await chai_request
      .execute(server)
      .post(`/api/leagues/1/trades/${tradeid}/veto`)
      .set('Authorization', `Bearer ${user1}`)

    const request = chai_request
      .execute(server)
      .post(`/api/leagues/1/trades/${tradeid}/veto`)
      .set('Authorization', `Bearer ${user1}`)

    await error(request, 'trade has already been vetoed')
  })

  it('marks an unaccepted trade vetoed without moving anyone', async () => {
    const proposing_row = await get_roster_player({ tid: 1 })

    const propose_res = await chai_request
      .execute(server)
      .post('/api/leagues/1/trades')
      .set('Authorization', `Bearer ${user1}`)
      .send({
        proposingTeamPlayers: [proposing_row.pid],
        acceptingTeamPlayers: [],
        proposing_team_slots: {},
        accepting_team_slots: {
          [proposing_row.pid]: roster_slot_types.BENCH
        },
        propose_tid: 1,
        accept_tid: 2,
        leagueId: 1
      })
    propose_res.should.have.status(200)

    const veto_res = await chai_request
      .execute(server)
      .post(`/api/leagues/1/trades/${propose_res.body.uid}/veto`)
      .set('Authorization', `Bearer ${user1}`)
    veto_res.should.have.status(200)

    should.not.exist(veto_res.body.accepted)
    should.exist(veto_res.body.vetoed)

    const rows = await knex('rosters_players').where({ pid: proposing_row.pid })
    rows[0].tid.should.equal(1)
  })

  it('lists a vetoable trade for the commissioner', async () => {
    const { tradeid } = await propose_and_accept_one_for_one()

    const res = await chai_request
      .execute(server)
      .get('/api/leagues/1/trades?vetoable=true')
      .set('Authorization', `Bearer ${user1}`)
    res.should.have.status(200)

    res.body.length.should.equal(1)
    res.body[0].uid.should.equal(tradeid)
    // the commissioner is not party to every trade they rule on, so the list
    // has to carry the assets rather than just the trade row
    res.body[0].proposingTeamPlayers.length.should.equal(1)
  })

  it('omits an already vetoed trade from the vetoable list', async () => {
    const { tradeid } = await propose_and_accept_one_for_one()

    await chai_request
      .execute(server)
      .post(`/api/leagues/1/trades/${tradeid}/veto`)
      .set('Authorization', `Bearer ${user1}`)

    const res = await chai_request
      .execute(server)
      .get('/api/leagues/1/trades?vetoable=true')
      .set('Authorization', `Bearer ${user1}`)
    res.should.have.status(200)
    res.body.length.should.equal(0)
  })

  it('omits a trade whose veto window has closed', async () => {
    await propose_and_accept_one_for_one()

    MockDate.set(Date.now() + 25 * 60 * 60 * 1000)

    const res = await chai_request
      .execute(server)
      .get('/api/leagues/1/trades?vetoable=true')
      .set('Authorization', `Bearer ${user1}`)
    res.should.have.status(200)
    res.body.length.should.equal(0)
  })

  it('refuses a league-wide trade list to a non-commissioner', async () => {
    await propose_and_accept_one_for_one()

    const vetoable_res = await chai_request
      .execute(server)
      .get('/api/leagues/1/trades?vetoable=true')
      .set('Authorization', `Bearer ${user2}`)
    vetoable_res.should.have.status(401)

    const unscoped_res = await chai_request
      .execute(server)
      .get('/api/leagues/1/trades')
      .set('Authorization', `Bearer ${user2}`)
    unscoped_res.should.have.status(401)
  })
})
