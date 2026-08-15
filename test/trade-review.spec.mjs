/* global describe before beforeEach it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season } from '#constants'
import grade_trades, {
  LINEAGE_STATE
} from '#libs-server/trade-review/grade-trades.mjs'
import {
  TRANSFORMATION_TYPE,
  TERMINATED_BY,
  ASSET_TYPE
} from '#libs-server/roster-asset-lineage/constants.mjs'
import {
  transformation_type_labels,
  terminated_by_labels
} from '#libs-shared/format-lineage-event.mjs'
import { user1, user2, user3 } from './fixtures/token.mjs'
import { selectPlayer } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
chai.should()
chai.use(chai_http)
const expect = chai.expect
const { regular_season_start } = current_season

const LID = 1
const PROPOSE_TID = 1
const ACCEPT_TID = 2
const TRADE_UID = 1
const THIRD_TID = 3

// Holding ids are assigned by hand rather than by a sequence so the assertions
// can name them. roster_asset_holding.holding_id has no default.
const HOLDING = {
  SENT_PLAYER_ORIGIN: 101,
  SENT_PLAYER_RECEIVED: 102,
  SENT_PICK_ORIGIN: 103,
  SENT_PICK_RECEIVED: 104,
  DRAFTED_PLAYER: 105,
  // Only seeded by the per-team production case, which needs a holding that
  // belongs to neither side of the trade.
  MOVED_ON_PLAYER: 106
}

const TRADED_PLAYER_VALUE_AT_TRADE = 5000
const DRAFTED_PLAYER_VALUE_NOW = 7000

// One trade with both sides seeded, shared by the engine and the route specs.
// The route spec seeds it too rather than running against an empty league: a
// list that comes back empty makes every assertion about the response body
// vacuously true.
const seed_trade = async () => {
  await knex('roster_asset_transformation').del()
  await knex('roster_asset_holding').del()
  await knex('keeptradecut_valuations').del()

  const traded_player = await selectPlayer({ rookie: false })
  const drafted_player = await selectPlayer({ rookie: true })

  const season_row = await knex('seasons')
    .where({ lid: LID, season_year: current_season.year })
    .first()
  const league_format_id = season_row.league_format_id

  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const acquired_at = new Date(now - 120 * day)
  const traded_at = new Date(now - 90 * day)
  const released_at = new Date(now - 60 * day)
  const drafted_at = new Date(now - 30 * day)

  // Both sides of one trade, plus what the acquired pick later became.
  //
  // The pick leg is deliberately UNPRICED (no keeptradecut_value_at
  // _termination on its source holding), which is the pre-2023-09 case the
  // engine withholds the whole trade's at-trade figure for.
  await knex('roster_asset_holding').insert([
    {
      holding_id: HOLDING.SENT_PLAYER_ORIGIN,
      lid: LID,
      tid: PROPOSE_TID,
      asset_type: ASSET_TYPE.PLAYER,
      player_id: traded_player.pid,
      period_start: acquired_at,
      period_end: traded_at,
      terminated_by: TERMINATED_BY.TRADE,
      keeptradecut_value_at_termination: TRADED_PLAYER_VALUE_AT_TRADE,
      salary_paid: 20,
      weeks_started: 5,
      weeks_active: 10,
      weeks_practice_squad: 1,
      realized_pts_added_net_through_termination: 45.5,
      projected_pts_added_at_acquisition: 60.0,
      league_format_id
    },
    {
      holding_id: HOLDING.SENT_PLAYER_RECEIVED,
      lid: LID,
      tid: ACCEPT_TID,
      asset_type: ASSET_TYPE.PLAYER,
      player_id: traded_player.pid,
      period_start: traded_at,
      period_end: released_at,
      terminated_by: TERMINATED_BY.RELEASE,
      keeptradecut_value_at_termination: 4000,
      league_format_id
    },
    {
      holding_id: HOLDING.SENT_PICK_ORIGIN,
      lid: LID,
      tid: ACCEPT_TID,
      asset_type: ASSET_TYPE.PICK,
      pick_year: current_season.year + 1,
      pick_round: 1,
      period_start: acquired_at,
      period_end: traded_at,
      terminated_by: TERMINATED_BY.TRADE,
      keeptradecut_value_at_termination: null,
      league_format_id
    },
    {
      holding_id: HOLDING.SENT_PICK_RECEIVED,
      lid: LID,
      tid: PROPOSE_TID,
      asset_type: ASSET_TYPE.PICK,
      pick_year: current_season.year + 1,
      pick_round: 1,
      pick_draft_overall_position: 3,
      period_start: traded_at,
      period_end: drafted_at,
      terminated_by: TERMINATED_BY.PICK_CONVERTED,
      league_format_id
    },
    {
      holding_id: HOLDING.DRAFTED_PLAYER,
      lid: LID,
      tid: PROPOSE_TID,
      asset_type: ASSET_TYPE.PLAYER,
      player_id: drafted_player.pid,
      period_start: drafted_at,
      period_end: null,
      terminated_by: TERMINATED_BY.STILL_HELD,
      salary_paid: 5,
      weeks_started: 2,
      weeks_active: 4,
      weeks_practice_squad: 0,
      league_format_id
    }
  ])

  await knex('roster_asset_transformation').insert([
    {
      transformation_id: knex.raw('gen_random_uuid()'),
      lid: LID,
      transformation_type: TRANSFORMATION_TYPE.TRADE,
      occurred_at: traded_at,
      source_holding_id: HOLDING.SENT_PLAYER_ORIGIN,
      target_holding_id: HOLDING.SENT_PLAYER_RECEIVED,
      source_share: 1.0,
      target_share: 1.0,
      trade_uid: TRADE_UID
    },
    {
      transformation_id: knex.raw('gen_random_uuid()'),
      lid: LID,
      transformation_type: TRANSFORMATION_TYPE.TRADE,
      occurred_at: traded_at,
      source_holding_id: HOLDING.SENT_PICK_ORIGIN,
      target_holding_id: HOLDING.SENT_PICK_RECEIVED,
      source_share: 1.0,
      target_share: 1.0,
      trade_uid: TRADE_UID
    },
    {
      transformation_id: knex.raw('gen_random_uuid()'),
      lid: LID,
      transformation_type: TRANSFORMATION_TYPE.PICK_CONVERSION,
      occurred_at: drafted_at,
      source_holding_id: HOLDING.SENT_PICK_RECEIVED,
      target_holding_id: HOLDING.DRAFTED_PLAYER,
      source_share: 1.0,
      target_share: 1.0
    },
    // The second edge into the drafted player: a ROOT edge with a null
    // source, recording the draft event itself. It is the reason the chain
    // loader must filter to source_holding_id IS NOT NULL -- a bare join on
    // target_holding_id matches both edges and doubles every hop through a
    // drafted pick.
    {
      transformation_id: knex.raw('gen_random_uuid()'),
      lid: LID,
      transformation_type: TRANSFORMATION_TYPE.DRAFT,
      occurred_at: drafted_at,
      source_holding_id: null,
      target_holding_id: HOLDING.DRAFTED_PLAYER,
      target_share: 1.0
    },
    {
      transformation_id: knex.raw('gen_random_uuid()'),
      lid: LID,
      transformation_type: TRANSFORMATION_TYPE.RELEASE,
      occurred_at: released_at,
      source_holding_id: HOLDING.SENT_PLAYER_RECEIVED,
      target_holding_id: null,
      source_share: 1.0
    }
  ])

  await knex('trades').insert({
    uid: TRADE_UID,
    propose_tid: PROPOSE_TID,
    accept_tid: ACCEPT_TID,
    lid: LID,
    userid: 1,
    season_year: current_season.year,
    offered: new Date(traded_at.getTime() - 3600 * 1000),
    accepted: traded_at
  })

  await knex('keeptradecut_valuations').insert({
    pid: drafted_player.pid,
    is_superflex: true,
    observed_at: new Date(now),
    keeptradecut_value: DRAFTED_PLAYER_VALUE_NOW
  })

  return { traded_player, drafted_player }
}

describe('LIBS SERVER trade-review', function () {
  let traded_player
  let drafted_player

  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    await league(knex)
    ;({ traded_player, drafted_player } = await seed_trade())
  })

  it('returns exactly two sign-inverted perspectives per trade', async () => {
    const results = await grade_trades({ lid: LID })

    const trade_uids = new Set(results.map((record) => record.trade_uid))
    for (const trade_uid of trade_uids) {
      const records = results.filter((record) => record.trade_uid === trade_uid)
      expect(records.length).to.equal(2)

      const [first, second] = records
      expect(first.tid).to.equal(second.counterparty_tid)
      expect(second.tid).to.equal(first.counterparty_tid)
      expect(first.net_value_realized).to.equal(-second.net_value_realized)
      if (first.net_value_at_trade == null) {
        expect(second.net_value_at_trade).to.equal(null)
      } else {
        expect(first.net_value_at_trade).to.equal(-second.net_value_at_trade)
      }
    }
  })

  // The failure this catches is a lineage join that returns only depth-zero
  // self-references. Every asset would then report hop_count 0 and a page built
  // on it would look entirely plausible while showing nothing the surface
  // exists to show.
  it('follows an asset past the trade it was acquired in', async () => {
    const results = await grade_trades({ lid: LID })
    const all_assets = results.flatMap((record) => [
      ...record.acquired_assets,
      ...record.sent_assets
    ])

    expect(all_assets.some((asset) => asset.hop_count > 0)).to.equal(
      true,
      'no traded asset has a single onward hop; the lineage walk returned only roots'
    )

    const proposer = results.find((record) => record.tid === PROPOSE_TID)
    const acquired_pick = proposer.acquired_assets[0]
    expect(acquired_pick.origin_holding_id).to.equal(HOLDING.SENT_PICK_RECEIVED)
    expect(acquired_pick.hop_count).to.equal(1)
    expect(acquired_pick.lineage_state).to.equal(LINEAGE_STATE.held)
    expect(acquired_pick.resulting_assets.length).to.equal(1)
    expect(acquired_pick.resulting_assets[0].player_id).to.equal(
      drafted_player.pid
    )
    expect(acquired_pick.current_keeptradecut_value).to.equal(
      DRAFTED_PLAYER_VALUE_NOW
    )
  })

  // The fan-out guard. A drafted pick carries two incoming transformation
  // edges, so a join on bare target_holding_id emits the drafted player twice
  // and every value derived from the chain doubles.
  it('emits each reachable holding once per origin', async () => {
    const results = await grade_trades({ lid: LID, trade_uid: TRADE_UID })
    const seen = new Set()

    for (const record of results) {
      for (const asset of [...record.acquired_assets, ...record.sent_assets]) {
        for (const chain_row of asset.chain) {
          const pair = `${chain_row.originating_holding_id}__${chain_row.current_holding_id}`
          expect(seen.has(`${record.tid}__${pair}`)).to.equal(
            false,
            `chain pair ${pair} appeared twice; the transformation join fanned out`
          )
          seen.add(`${record.tid}__${pair}`)
        }
      }
    }
  })

  it('names a consumed asset rather than reporting it as unwalked', async () => {
    const results = await grade_trades({ lid: LID })
    const accepter = results.find((record) => record.tid === ACCEPT_TID)
    const acquired_player = accepter.acquired_assets[0]

    expect(acquired_player.player_id).to.equal(traded_player.pid)
    expect(acquired_player.lineage_state).to.equal(LINEAGE_STATE.no_longer_held)
    expect(acquired_player.resulting_assets.length).to.equal(0)
    expect(acquired_player.current_keeptradecut_value).to.equal(0)
  })

  // Derived from the source data rather than asserted as a constant: which
  // legs are unpriced is a property of the KeepTradeCut archive and drifts.
  it('withholds the at-trade figure whenever any leg is unpriced', async () => {
    const unpriced_rows = await knex('view_trade_asset_flow')
      .where('lid', LID)
      .whereNull('keeptradecut_value_at_trade')
      .select('trade_uid')
    const unpriced_trade_uids = new Set(
      unpriced_rows.map((row) => row.trade_uid)
    )
    expect(unpriced_trade_uids.size).to.be.greaterThan(
      0,
      'fixture has no unpriced leg, so this assertion proves nothing'
    )

    const results = await grade_trades({ lid: LID })
    for (const record of results) {
      if (unpriced_trade_uids.has(record.trade_uid)) {
        expect(record.net_value_at_trade).to.equal(null)
        expect(record.net_value_change).to.equal(null)
        expect(record.unpriced_leg_count).to.be.greaterThan(0)
      } else {
        expect(record.net_value_at_trade).to.be.a('number')
      }
    }
  })

  // Neither map may be short a value: an unlabelled transformation renders as
  // a bare integer, and an unlabelled termination renders as the generic
  // fallback, both of which read as data rather than as a rendering gap.
  it('labels every transformation type and termination reason', () => {
    const labelled_transformations = Object.keys(transformation_type_labels)
      .map(Number)
      .sort((a, b) => a - b)
    expect(labelled_transformations).to.deep.equal(
      Object.values(TRANSFORMATION_TYPE).sort((a, b) => a - b)
    )

    const labelled_terminations = Object.keys(terminated_by_labels)
      .map(Number)
      .sort((a, b) => a - b)
    expect(labelled_terminations).to.deep.equal(
      Object.values(TERMINATED_BY).sort((a, b) => a - b)
    )
  })
})

describe('API /leagues/:leagueId/trade-review', function () {
  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    await league(knex)
    await seed_trade()
  })

  it('serves a non-commissioner team owner', async () => {
    const res = await chai_request
      .execute(server)
      .get(`/api/leagues/${LID}/trade-review`)
      .set('Authorization', `Bearer ${user2}`)

    res.should.have.status(200)
    res.should.be.json
    expect(res.body).to.be.an('array')
  })

  it('refuses a user who owns no team in the league', async () => {
    await knex('users_teams').where({ userid: 3 }).del()

    const res = await chai_request
      .execute(server)
      .get(`/api/leagues/${LID}/trade-review`)
      .set('Authorization', `Bearer ${user3}`)

    res.should.have.status(403)
  })

  it('refuses an unauthenticated caller', async () => {
    const res = await chai_request
      .execute(server)
      .get(`/api/leagues/${LID}/trade-review`)

    res.should.have.status(401)
  })

  // The list is the same records minus the chains. Shipping chains on the list
  // is an order of magnitude more payload for something no collapsed row
  // renders.
  it('omits lineage chains from the list and carries them on the detail', async () => {
    const list_res = await chai_request
      .execute(server)
      .get(`/api/leagues/${LID}/trade-review`)
      .set('Authorization', `Bearer ${user1}`)

    list_res.should.have.status(200)
    for (const record of list_res.body) {
      for (const asset of [...record.acquired_assets, ...record.sent_assets]) {
        expect(asset).to.not.have.property('chain')
        expect(asset).to.have.property('lineage_state')
      }
    }

    expect(list_res.body.length).to.equal(
      2,
      'the seeded trade is missing from the list, so nothing below is tested'
    )

    const trade_uid = list_res.body[0].trade_uid
    const detail_res = await chai_request
      .execute(server)
      .get(`/api/leagues/${LID}/trade-review/${trade_uid}`)
      .set('Authorization', `Bearer ${user1}`)

    detail_res.should.have.status(200)
    expect(detail_res.body.length).to.equal(2)
    for (const record of detail_res.body) {
      for (const asset of [...record.acquired_assets, ...record.sent_assets]) {
        expect(asset).to.have.property('chain')
      }
    }
  })

  // The list route strips chains, so a collapsed card cannot sum production for
  // itself -- these two fields are the only way it can report what a side
  // actually scored. The rule they encode is that a chain follows an asset PAST
  // the receiving team, so a later holder's rows must not be counted.
  it('carries per-team production on both routes, counting only that team', async () => {
    // Extend the shared fixture, for this case only, with a hop that carries
    // the drafted player on to a THIRD team. Without it the two teams' chains
    // hold nothing but their own holdings, and an assertion on the sums agrees
    // whether or not the team filter exists.
    const drafted_holding = await knex('roster_asset_holding')
      .where({ holding_id: HOLDING.DRAFTED_PLAYER })
      .first()
    const moved_on_at = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)

    await knex('roster_asset_holding')
      .where({ holding_id: HOLDING.DRAFTED_PLAYER })
      .update({ period_end: moved_on_at, terminated_by: TERMINATED_BY.TRADE })

    await knex('roster_asset_holding').insert({
      holding_id: HOLDING.MOVED_ON_PLAYER,
      lid: LID,
      tid: THIRD_TID,
      asset_type: ASSET_TYPE.PLAYER,
      player_id: drafted_holding.player_id,
      period_start: moved_on_at,
      period_end: null,
      terminated_by: TERMINATED_BY.STILL_HELD,
      salary_paid: 50,
      weeks_started: 3,
      weeks_active: 3,
      weeks_practice_squad: 0,
      realized_pts_added_net_through_termination: 33.3,
      league_format_id: drafted_holding.league_format_id
    })

    await knex('roster_asset_transformation').insert({
      transformation_id: knex.raw('gen_random_uuid()'),
      lid: LID,
      transformation_type: TRANSFORMATION_TYPE.TRADE,
      occurred_at: moved_on_at,
      source_holding_id: HOLDING.DRAFTED_PLAYER,
      target_holding_id: HOLDING.MOVED_ON_PLAYER,
      source_share: 1.0,
      target_share: 1.0
    })

    const list_res = await chai_request
      .execute(server)
      .get(`/api/leagues/${LID}/trade-review`)
      .set('Authorization', `Bearer ${user1}`)

    list_res.should.have.status(200)
    expect(list_res.body.length).to.equal(2)
    for (const record of list_res.body) {
      expect(record.realized_points_added_while_held).to.be.a('number')
      expect(record.salary_paid_while_held).to.be.a('number')
    }

    const detail_res = await chai_request
      .execute(server)
      .get(`/api/leagues/${LID}/trade-review/${TRADE_UID}`)
      .set('Authorization', `Bearer ${user1}`)

    detail_res.should.have.status(200)

    let counted_a_foreign_holding = false
    for (const record of detail_res.body) {
      let expected_points = 0
      let expected_salary = 0
      for (const asset of record.acquired_assets) {
        for (const chain_row of asset.chain) {
          if (chain_row.tid !== record.tid) {
            counted_a_foreign_holding = true
            continue
          }
          expected_points += Number(
            chain_row.realized_pts_added_net_through_termination ?? 0
          )
          expected_salary += Number(chain_row.salary_paid ?? 0)
        }
      }

      expect(record.realized_points_added_while_held).to.be.closeTo(
        expected_points,
        0.05
      )
      expect(record.salary_paid_while_held).to.equal(
        Math.round(expected_salary)
      )
    }

    // Without a holding belonging to somebody else in the fixture, the sums
    // above would agree whether or not the filter exists, and the assertion
    // would pass over a rule it cannot see.
    expect(counted_a_foreign_holding).to.equal(
      true,
      'the fixture has no foreign-team holding, so the team filter is untested'
    )
  })

  it('returns 404 for a trade this league has no accepted record of', async () => {
    const res = await chai_request
      .execute(server)
      .get(`/api/leagues/${LID}/trade-review/999999`)
      .set('Authorization', `Bearer ${user1}`)

    res.should.have.status(404)
  })
})
