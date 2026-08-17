/* global describe before beforeEach it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season } from '#constants'
import grade_trades from '#libs-server/trade-review/grade-trades.mjs'
import {
  TRANSFORMATION_TYPE,
  TERMINATED_BY,
  ASSET_TYPE
} from '#libs-server/roster-asset-lineage/constants.mjs'
// A NAMESPACE import: the state-label case asserts that a map exists, and a
// named import of a map that does not yet exist is a SyntaxError at module
// load, which takes the whole suite down instead of failing one case.
import * as format_lineage from '#libs-shared/format-lineage-event.mjs'
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
  MOVED_ON_PLAYER: 106,
  // Only seeded by the zero-priced case, which needs a trade whose every leg
  // is priced and one of whose legs is priced at exactly 0.
  ZERO_PRICED_ORIGIN: 201,
  ZERO_PRICED_RECEIVED: 202,
  PRICED_ORIGIN: 203,
  PRICED_RECEIVED: 204
}

const ZERO_PRICED_TRADE_UID = 2
const ZERO_PRICED_COUNTERPARTY_VALUE = 3000

// The closed set the engine declares. Written out here rather than imported:
// the spec is the contract, and importing the engine's own list would make the
// case agree with whatever the engine happens to emit.
const TEAM_ASSET_STATES = ['still_held', 'traded_onward', 'consumed']

// Every value distinct, so no two figures the cases distinguish can be
// confused for one another.
const FINAL_ASSET_VALUE_TODAY = 6100
const REACQUIRED_ASSET_VALUE_TODAY = 7300
const EXCHANGED_ASSET_VALUE_TODAY = 3200
const BUNDLE_RETURN_VALUE_TODAY = 8000
const BUNDLE_SUBJECT_VALUE_AT_TRADE = 2000
const BUNDLE_PARTNER_VALUE_AT_TRADE = 6000
// 2000 of an 8000 outgoing bundle against an 8000 return.
const BUNDLE_SUBJECT_PROCEEDS = 2000

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
    user_id: 1,
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

// A second trade whose every leg IS priced, one of them at exactly 0. A stored
// 0 is a genuine quote for a player off the KeepTradeCut board on the trade
// date, so this trade's at-trade figure must be a number.
//
// Seeded per case rather than in seed_trade: the shared fixture's record count
// is asserted elsewhere, and this trade would change it.
const seed_zero_priced_trade = async ({ exclude_pids }) => {
  const zero_priced_player = await selectPlayer({
    rookie: false,
    exclude_pids
  })
  const counterparty_player = await selectPlayer({
    rookie: false,
    exclude_pids: [...exclude_pids, zero_priced_player.pid]
  })

  const season_row = await knex('seasons')
    .where({ lid: LID, season_year: current_season.year })
    .first()
  const league_format_id = season_row.league_format_id

  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const acquired_at = new Date(now - 200 * day)
  const traded_at = new Date(now - 150 * day)

  await knex('roster_asset_holding').insert([
    {
      holding_id: HOLDING.ZERO_PRICED_ORIGIN,
      lid: LID,
      tid: PROPOSE_TID,
      asset_type: ASSET_TYPE.PLAYER,
      player_id: zero_priced_player.pid,
      period_start: acquired_at,
      period_end: traded_at,
      terminated_by: TERMINATED_BY.TRADE,
      keeptradecut_value_at_termination: 0,
      league_format_id
    },
    {
      holding_id: HOLDING.ZERO_PRICED_RECEIVED,
      lid: LID,
      tid: ACCEPT_TID,
      asset_type: ASSET_TYPE.PLAYER,
      player_id: zero_priced_player.pid,
      period_start: traded_at,
      period_end: null,
      terminated_by: TERMINATED_BY.STILL_HELD,
      league_format_id
    },
    {
      holding_id: HOLDING.PRICED_ORIGIN,
      lid: LID,
      tid: ACCEPT_TID,
      asset_type: ASSET_TYPE.PLAYER,
      player_id: counterparty_player.pid,
      period_start: acquired_at,
      period_end: traded_at,
      terminated_by: TERMINATED_BY.TRADE,
      keeptradecut_value_at_termination: ZERO_PRICED_COUNTERPARTY_VALUE,
      league_format_id
    },
    {
      holding_id: HOLDING.PRICED_RECEIVED,
      lid: LID,
      tid: PROPOSE_TID,
      asset_type: ASSET_TYPE.PLAYER,
      player_id: counterparty_player.pid,
      period_start: traded_at,
      period_end: null,
      terminated_by: TERMINATED_BY.STILL_HELD,
      league_format_id
    }
  ])

  await knex('roster_asset_transformation').insert([
    {
      transformation_id: knex.raw('gen_random_uuid()'),
      lid: LID,
      transformation_type: TRANSFORMATION_TYPE.TRADE,
      occurred_at: traded_at,
      source_holding_id: HOLDING.ZERO_PRICED_ORIGIN,
      target_holding_id: HOLDING.ZERO_PRICED_RECEIVED,
      source_share: 1.0,
      target_share: 1.0,
      trade_uid: ZERO_PRICED_TRADE_UID
    },
    {
      transformation_id: knex.raw('gen_random_uuid()'),
      lid: LID,
      transformation_type: TRANSFORMATION_TYPE.TRADE,
      occurred_at: traded_at,
      source_holding_id: HOLDING.PRICED_ORIGIN,
      target_holding_id: HOLDING.PRICED_RECEIVED,
      source_share: 1.0,
      target_share: 1.0,
      trade_uid: ZERO_PRICED_TRADE_UID
    }
  ])

  await knex('trades').insert({
    uid: ZERO_PRICED_TRADE_UID,
    propose_tid: PROPOSE_TID,
    accept_tid: ACCEPT_TID,
    lid: LID,
    user_id: 1,
    season_year: current_season.year,
    offered: new Date(traded_at.getTime() - 3600 * 1000),
    accepted: traded_at
  })

  return { zero_priced_player, counterparty_player }
}

// A declarative builder for the consideration-traversal cases. Each of those
// needs a multi-trade conversion chain, which is unreadable written out as raw
// holding and transformation inserts.
//
// Values are deliberately distinct per asset: two fixture columns holding the
// same number cannot be told apart, so a weighting bug or a double count would
// land on a figure that agrees with the correct one.
const build_lineage = () => {
  let next_holding_id = 300
  const holdings = []
  const transformations = []
  const trades = []
  const day = 24 * 60 * 60 * 1000
  const base_time = Date.now() - 400 * day

  const at = (days_from_base) => new Date(base_time + days_from_base * day)

  // One holding of one asset by one team, open unless it is later closed by
  // hold_traded / hold_released.
  const hold = ({ tid, player_id, opened_on }) => {
    const holding_id = next_holding_id++
    const row = {
      holding_id,
      lid: LID,
      tid,
      asset_type: ASSET_TYPE.PLAYER,
      player_id,
      period_start: at(opened_on),
      period_end: null,
      terminated_by: TERMINATED_BY.STILL_HELD
    }
    holdings.push(row)
    return row
  }

  // Move an asset between teams in a trade. `value_at_trade` is the SENDING
  // holding's quote, which is what view_trade_asset_flow exposes as the leg's
  // keeptradecut_value_at_trade and what the proceeds weight is computed from.
  const trade_leg = ({
    from_holding,
    to_tid,
    trade_uid,
    occurred_on,
    value_at_trade,
    // A trade transformation carrying no trade_uid: the onward trade cannot be
    // resolved, so the proceeds figure must be withheld rather than zeroed.
    unresolvable = false
  }) => {
    from_holding.period_end = at(occurred_on)
    from_holding.terminated_by = TERMINATED_BY.TRADE
    from_holding.keeptradecut_value_at_termination = value_at_trade
    const to_holding = hold({
      tid: to_tid,
      player_id: from_holding.player_id,
      opened_on: occurred_on
    })
    transformations.push({
      transformation_id: knex.raw('gen_random_uuid()'),
      lid: LID,
      transformation_type: TRANSFORMATION_TYPE.TRADE,
      occurred_at: at(occurred_on),
      source_holding_id: from_holding.holding_id,
      target_holding_id: to_holding.holding_id,
      source_share: 1.0,
      target_share: 1.0,
      trade_uid: unresolvable ? null : trade_uid
    })
    return to_holding
  }

  const release = ({ from_holding, occurred_on }) => {
    from_holding.period_end = at(occurred_on)
    from_holding.terminated_by = TERMINATED_BY.RELEASE
    transformations.push({
      transformation_id: knex.raw('gen_random_uuid()'),
      lid: LID,
      transformation_type: TRANSFORMATION_TYPE.RELEASE,
      occurred_at: at(occurred_on),
      source_holding_id: from_holding.holding_id,
      target_holding_id: null,
      source_share: 1.0
    })
  }

  const trade = ({ uid, occurred_on, propose_tid, accept_tid }) => {
    trades.push({
      uid,
      propose_tid,
      accept_tid,
      lid: LID,
      user_id: 1,
      season_year: current_season.year,
      offered: at(occurred_on - 1),
      accepted: at(occurred_on)
    })
  }

  const write = async ({ league_format_id }) => {
    await knex('roster_asset_holding').insert(
      holdings.map((row) => ({ ...row, league_format_id }))
    )
    await knex('roster_asset_transformation').insert(transformations)
    await knex('trades').insert(trades)
  }

  return { hold, trade_leg, release, trade, write, at }
}

// A player whose current KeepTradeCut quote is `value`, so a terminal holding
// of him is worth exactly that today.
const make_valued_player = async ({ exclude_pids, value }) => {
  const player = await selectPlayer({ rookie: false, exclude_pids })
  await knex('keeptradecut_valuations').insert({
    pid: player.pid,
    is_superflex: true,
    observed_at: new Date(),
    keeptradecut_value: value
  })
  return player
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
      expect(first.net_value_still_held).to.equal(-second.net_value_still_held)
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
    expect(acquired_pick.team_asset_state).to.equal('still_held')
    expect(acquired_pick.resulting_assets.length).to.equal(1)
    expect(acquired_pick.resulting_assets[0].player_id).to.equal(
      drafted_player.pid
    )
    expect(acquired_pick.keeptradecut_value_still_held).to.equal(
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
    expect(acquired_player.team_asset_state).to.equal('consumed')
    expect(acquired_player.resulting_assets.length).to.equal(0)
    expect(acquired_player.keeptradecut_value_still_held).to.equal(0)
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
        expect(record.net_value_proceeds_change).to.equal(null)
        expect(record.unpriced_leg_count).to.be.greaterThan(0)
      } else {
        expect(record.net_value_at_trade).to.be.a('number')
      }
    }
  })

  // The truthiness test and the null check differ by one character and read
  // alike, so nothing but a leg priced at exactly 0 can tell them apart.
  it('prices a leg quoted at exactly zero rather than counting it unpriced', async () => {
    const { zero_priced_player } = await seed_zero_priced_trade({
      exclude_pids: [traded_player.pid, drafted_player.pid]
    })

    const zero_legs = await knex('view_trade_asset_flow')
      .where({ lid: LID, trade_uid: ZERO_PRICED_TRADE_UID })
      .select('keeptradecut_value_at_trade')
    expect(
      zero_legs.some(
        (leg) =>
          leg.keeptradecut_value_at_trade != null &&
          Number(leg.keeptradecut_value_at_trade) === 0
      )
    ).to.equal(
      true,
      'the fixture has no leg priced at exactly 0, so this case proves nothing'
    )

    const results = await grade_trades({
      lid: LID,
      trade_uid: ZERO_PRICED_TRADE_UID
    })
    expect(results.length).to.equal(2)

    for (const record of results) {
      expect(record.unpriced_leg_count).to.equal(
        0,
        'a leg quoted at exactly 0 was counted as unpriced'
      )
      expect(record.net_value_at_trade).to.be.a('number')
    }

    const proposer = results.find((record) => record.tid === PROPOSE_TID)
    const sent_zero = proposer.sent_assets.find(
      (asset) => asset.player_id === zero_priced_player.pid
    )
    expect(sent_zero.keeptradecut_value_at_trade).to.equal(0)
    expect(proposer.net_value_at_trade).to.equal(ZERO_PRICED_COUNTERPARTY_VALUE)
  })

  // Neither map may be short a value: an unlabelled transformation renders as
  // a bare integer, and an unlabelled termination renders as the generic
  // fallback, both of which read as data rather than as a rendering gap.
  it('labels every transformation type and termination reason', () => {
    const labelled_transformations = Object.keys(
      format_lineage.transformation_type_labels
    )
      .map(Number)
      .sort((a, b) => a - b)
    expect(labelled_transformations).to.deep.equal(
      Object.values(TRANSFORMATION_TYPE).sort((a, b) => a - b)
    )

    const labelled_terminations = Object.keys(
      format_lineage.terminated_by_labels
    )
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
    await knex('users_teams').where({ user_id: 3 }).del()

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
        expect(asset).to.have.property('team_asset_state')
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

// The consideration traversal. Each case below is a shape that passed the
// first design's own checks and was wrong: they are the reason the figure is
// computed from an unfiltered load, stops at the team's first disposal,
// resolves the onward trade by transformation type, and withholds rather than
// zeroes.
describe('LIBS SERVER trade-review consideration traversal', function () {
  let league_format_id
  let used_pids

  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    await league(knex)
    await knex('roster_asset_transformation').del()
    await knex('roster_asset_holding').del()
    await knex('keeptradecut_valuations').del()
    await knex('trades').where({ lid: LID }).del()

    const season_row = await knex('seasons')
      .where({ lid: LID, season_year: current_season.year })
      .first()
    league_format_id = season_row.league_format_id
    used_pids = []
  })

  const claim_player = async ({ value = null } = {}) => {
    const player = value
      ? await make_valued_player({ exclude_pids: used_pids, value })
      : await selectPlayer({ rookie: false, exclude_pids: used_pids })
    used_pids.push(player.pid)
    return player
  }

  // Team 1 receives an asset, converts it through two further trades, and the
  // original line dies under a later team. Its still-held value is zero and its
  // proceeds are the asset it ended up with. This is the trade-29 shape.
  const seed_conversion_chain = async () => {
    const lineage = build_lineage()
    const sent_player = await claim_player()
    const received_player = await claim_player()
    const middle_player = await claim_player()
    const final_player = await claim_player({ value: FINAL_ASSET_VALUE_TODAY })

    const sent = lineage.hold({
      tid: 1,
      player_id: sent_player.pid,
      opened_on: 0
    })
    const received_origin = lineage.hold({
      tid: 2,
      player_id: received_player.pid,
      opened_on: 0
    })
    const middle_origin = lineage.hold({
      tid: 3,
      player_id: middle_player.pid,
      opened_on: 0
    })
    const final_origin = lineage.hold({
      tid: 4,
      player_id: final_player.pid,
      opened_on: 0
    })

    lineage.trade({ uid: 10, occurred_on: 10, propose_tid: 1, accept_tid: 2 })
    lineage.trade_leg({
      from_holding: sent,
      to_tid: 2,
      trade_uid: 10,
      occurred_on: 10,
      value_at_trade: 5000
    })
    const received = lineage.trade_leg({
      from_holding: received_origin,
      to_tid: 1,
      trade_uid: 10,
      occurred_on: 10,
      value_at_trade: 4500
    })

    // Deliberately across a calendar year boundary from trade 10: consideration
    // chains cross years by construction, which is what a year-filtered list
    // truncates.
    lineage.trade({ uid: 11, occurred_on: 200, propose_tid: 1, accept_tid: 3 })
    const passed_on = lineage.trade_leg({
      from_holding: received,
      to_tid: 3,
      trade_uid: 11,
      occurred_on: 200,
      value_at_trade: 4000
    })
    const middle = lineage.trade_leg({
      from_holding: middle_origin,
      to_tid: 1,
      trade_uid: 11,
      occurred_on: 200,
      value_at_trade: 3800
    })
    // The original line dies under the team it was passed to, which is what
    // makes the still-held figure zero and a terminal-partition state read
    // "consumed" beside a non-zero proceeds figure.
    lineage.release({ from_holding: passed_on, occurred_on: 210 })

    lineage.trade({ uid: 12, occurred_on: 300, propose_tid: 1, accept_tid: 4 })
    lineage.trade_leg({
      from_holding: middle,
      to_tid: 4,
      trade_uid: 12,
      occurred_on: 300,
      value_at_trade: 3600
    })
    lineage.trade_leg({
      from_holding: final_origin,
      to_tid: 1,
      trade_uid: 12,
      occurred_on: 300,
      value_at_trade: 3400
    })

    await lineage.write({ league_format_id })
    return { received_player, final_player }
  }

  const acquired_leg = (records, { trade_uid, tid, player_id }) => {
    const record = records.find(
      (row) => row.trade_uid === trade_uid && row.tid === tid
    )
    expect(record, `no record for trade ${trade_uid} tid ${tid}`).to.exist
    const asset = record.acquired_assets.find(
      (row) => row.player_id === player_id
    )
    expect(asset, `no acquired leg for player ${player_id}`).to.exist
    return { record, asset }
  }

  it('follows the consideration when the asset line dies under a later team', async () => {
    const { received_player } = await seed_conversion_chain()
    const records = await grade_trades({ lid: LID })
    const { asset } = acquired_leg(records, {
      trade_uid: 10,
      tid: 1,
      player_id: received_player.pid
    })

    expect(asset.keeptradecut_value_still_held).to.equal(
      0,
      'the received line has no holding left anywhere, let alone with this team'
    )
    expect(asset.keeptradecut_value_proceeds).to.equal(
      FINAL_ASSET_VALUE_TODAY,
      'the team converted the asset through two trades into something it still holds'
    )
    expect(asset.team_asset_state).to.equal(
      'traded_onward',
      'a state derived from the terminal partition reads this as consumed'
    )
  })

  // The engine narrows its leg set by trade_uid before building the index maps
  // a traversal consumes, so a traversal that reuses them collapses to the
  // still-held figure on the detail route. It fails as a smaller number and
  // never as a null, so mirror symmetry cannot see it.
  it('agrees between a single-trade call and a full-league call', async () => {
    const { received_player } = await seed_conversion_chain()

    const full_league = await grade_trades({ lid: LID })
    const single_trade = await grade_trades({ lid: LID, trade_uid: 10 })

    const from_full = acquired_leg(full_league, {
      trade_uid: 10,
      tid: 1,
      player_id: received_player.pid
    })
    // Read the year off the record rather than assuming it. The conversion
    // chain deliberately spans a long window, and the point of the year case is
    // that consideration chains cross year boundaries by construction -- so the
    // filter has to select trade 10 and exclude at least one later trade in its
    // own chain, which is the shape that loses records.
    const trade_year = from_full.record.occurred_at.getUTCFullYear()
    const by_year = await grade_trades({ lid: LID, year: trade_year })
    expect(
      by_year.length,
      'the year filter selected every record, so it cannot truncate anything'
    ).to.be.lessThan(full_league.length)
    expect(from_full.asset.keeptradecut_value_proceeds).to.be.greaterThan(
      0,
      'the unfiltered figure is zero, so agreement below would be vacuous'
    )

    for (const [label, records] of [
      ['trade_uid', single_trade],
      ['year', by_year]
    ]) {
      const { record, asset } = acquired_leg(records, {
        trade_uid: 10,
        tid: 1,
        player_id: received_player.pid
      })
      expect(asset.keeptradecut_value_proceeds).to.equal(
        from_full.asset.keeptradecut_value_proceeds,
        `the ${label} filter truncated the consideration walk`
      )
      expect(record.net_value_proceeds).to.equal(
        from_full.record.net_value_proceeds,
        `the ${label} filter truncated the record figure`
      )
    }
  })

  it('counts a reacquired line once, not the proceeds and the asset back', async () => {
    const lineage = build_lineage()
    const first_sent = await claim_player()
    const moved = await claim_player({ value: REACQUIRED_ASSET_VALUE_TODAY })
    const exchanged = await claim_player({ value: EXCHANGED_ASSET_VALUE_TODAY })
    const buyback = await claim_player()

    const first_sent_holding = lineage.hold({
      tid: 1,
      player_id: first_sent.pid,
      opened_on: 0
    })
    const moved_origin = lineage.hold({
      tid: 2,
      player_id: moved.pid,
      opened_on: 0
    })
    const exchanged_origin = lineage.hold({
      tid: 2,
      player_id: exchanged.pid,
      opened_on: 0
    })
    const buyback_holding = lineage.hold({
      tid: 1,
      player_id: buyback.pid,
      opened_on: 0
    })

    lineage.trade({ uid: 20, occurred_on: 10, propose_tid: 1, accept_tid: 2 })
    lineage.trade_leg({
      from_holding: first_sent_holding,
      to_tid: 2,
      trade_uid: 20,
      occurred_on: 10,
      value_at_trade: 5000
    })
    const moved_to_one = lineage.trade_leg({
      from_holding: moved_origin,
      to_tid: 1,
      trade_uid: 20,
      occurred_on: 10,
      value_at_trade: 4800
    })

    // Team 1 trades the line away and takes back a different asset for it.
    lineage.trade({ uid: 21, occurred_on: 20, propose_tid: 1, accept_tid: 2 })
    const moved_back_to_two = lineage.trade_leg({
      from_holding: moved_to_one,
      to_tid: 2,
      trade_uid: 21,
      occurred_on: 20,
      value_at_trade: 4600
    })
    lineage.trade_leg({
      from_holding: exchanged_origin,
      to_tid: 1,
      trade_uid: 21,
      occurred_on: 20,
      value_at_trade: 4400
    })

    // ...and later buys the same line back, which is the double count.
    lineage.trade({ uid: 22, occurred_on: 30, propose_tid: 1, accept_tid: 2 })
    lineage.trade_leg({
      from_holding: buyback_holding,
      to_tid: 2,
      trade_uid: 22,
      occurred_on: 30,
      value_at_trade: 4200
    })
    lineage.trade_leg({
      from_holding: moved_back_to_two,
      to_tid: 1,
      trade_uid: 22,
      occurred_on: 30,
      value_at_trade: 4000
    })

    await lineage.write({ league_format_id })

    const records = await grade_trades({ lid: LID })
    const { asset } = acquired_leg(records, {
      trade_uid: 20,
      tid: 1,
      player_id: moved.pid
    })

    expect(asset.keeptradecut_value_proceeds).to.equal(
      EXCHANGED_ASSET_VALUE_TODAY,
      'the figure counted both what the team got in exchange and the line coming back'
    )
    // Precedence: the team disposed of this line, so the state names the
    // disposal even though the same line is on its roster again today.
    expect(asset.team_asset_state).to.equal('traded_onward')
    expect(asset.keeptradecut_value_still_held).to.equal(
      REACQUIRED_ASSET_VALUE_TODAY,
      'still-held is a different quantity and does see the reacquisition'
    )
  })

  // Seeds team 1 receiving one asset and trading it onward in a bundle with a
  // second, differently-valued asset. The weight is this holding's share of the
  // at-trade value of the whole outgoing bundle.
  const seed_bundle = async ({ partner_value_at_trade }) => {
    const lineage = build_lineage()
    const first_sent = await claim_player()
    const bundled = await claim_player()
    const partner = await claim_player()
    const received_back = await claim_player({
      value: BUNDLE_RETURN_VALUE_TODAY
    })

    const first_sent_holding = lineage.hold({
      tid: 1,
      player_id: first_sent.pid,
      opened_on: 0
    })
    const bundled_origin = lineage.hold({
      tid: 2,
      player_id: bundled.pid,
      opened_on: 0
    })
    const partner_holding = lineage.hold({
      tid: 1,
      player_id: partner.pid,
      opened_on: 0
    })
    const received_origin = lineage.hold({
      tid: 3,
      player_id: received_back.pid,
      opened_on: 0
    })

    lineage.trade({ uid: 40, occurred_on: 10, propose_tid: 1, accept_tid: 2 })
    lineage.trade_leg({
      from_holding: first_sent_holding,
      to_tid: 2,
      trade_uid: 40,
      occurred_on: 10,
      value_at_trade: 5000
    })
    const bundled_at_one = lineage.trade_leg({
      from_holding: bundled_origin,
      to_tid: 1,
      trade_uid: 40,
      occurred_on: 10,
      value_at_trade: 4700
    })

    lineage.trade({ uid: 41, occurred_on: 20, propose_tid: 1, accept_tid: 3 })
    lineage.trade_leg({
      from_holding: bundled_at_one,
      to_tid: 3,
      trade_uid: 41,
      occurred_on: 20,
      value_at_trade: BUNDLE_SUBJECT_VALUE_AT_TRADE
    })
    lineage.trade_leg({
      from_holding: partner_holding,
      to_tid: 3,
      trade_uid: 41,
      occurred_on: 20,
      value_at_trade: partner_value_at_trade
    })
    lineage.trade_leg({
      from_holding: received_origin,
      to_tid: 1,
      trade_uid: 41,
      occurred_on: 20,
      value_at_trade: 9000
    })

    await lineage.write({ league_format_id })
    return { bundled }
  }

  it('weights the onward return by this asset share of the outgoing bundle', async () => {
    const { bundled } = await seed_bundle({
      partner_value_at_trade: BUNDLE_PARTNER_VALUE_AT_TRADE
    })
    const records = await grade_trades({ lid: LID })
    const { asset } = acquired_leg(records, {
      trade_uid: 40,
      tid: 1,
      player_id: bundled.pid
    })

    // 2000 of an 8000 bundle, against a return worth 8000 today. A weight of 1
    // in place of the share yields 8000 and fails this case.
    expect(asset.keeptradecut_value_proceeds).to.equal(
      BUNDLE_SUBJECT_PROCEEDS,
      'the weight is not this asset share of the outgoing bundle'
    )
  })

  it('withholds the figure whole when the outgoing bundle is unpriced', async () => {
    const { bundled } = await seed_bundle({ partner_value_at_trade: null })
    const records = await grade_trades({ lid: LID })
    const { record, asset } = acquired_leg(records, {
      trade_uid: 40,
      tid: 1,
      player_id: bundled.pid
    })

    expect(asset.keeptradecut_value_proceeds).to.equal(
      null,
      'an unpriced outgoing bundle makes the weight undefined; a partial sum beside a flag is not the answer'
    )
    expect(record.net_value_proceeds).to.equal(null)
    expect(record.net_value_proceeds_change).to.equal(null)
  })

  it('withholds rather than zeroes when the onward trade cannot be resolved', async () => {
    const lineage = build_lineage()
    const first_sent = await claim_player()
    const stranded = await claim_player()

    const first_sent_holding = lineage.hold({
      tid: 1,
      player_id: first_sent.pid,
      opened_on: 0
    })
    const stranded_origin = lineage.hold({
      tid: 2,
      player_id: stranded.pid,
      opened_on: 0
    })

    lineage.trade({ uid: 30, occurred_on: 10, propose_tid: 1, accept_tid: 2 })
    lineage.trade_leg({
      from_holding: first_sent_holding,
      to_tid: 2,
      trade_uid: 30,
      occurred_on: 10,
      value_at_trade: 5000
    })
    const stranded_at_one = lineage.trade_leg({
      from_holding: stranded_origin,
      to_tid: 1,
      trade_uid: 30,
      occurred_on: 10,
      value_at_trade: 4800
    })

    // A trade transformation with no trade_uid: the engine can see that the
    // team traded the asset away and cannot see what it got for it. Zero would
    // read as "got nothing", which is a different and false claim.
    lineage.trade_leg({
      from_holding: stranded_at_one,
      to_tid: 3,
      trade_uid: null,
      occurred_on: 20,
      value_at_trade: 4600,
      unresolvable: true
    })

    await lineage.write({ league_format_id })

    const records = await grade_trades({ lid: LID })
    const { asset } = acquired_leg(records, {
      trade_uid: 30,
      tid: 1,
      player_id: stranded.pid
    })

    expect(asset.keeptradecut_value_proceeds).to.equal(null)
    expect(asset.team_asset_state).to.equal('traded_onward')
  })

  it('keeps both perspectives sign-inverted on every figure', async () => {
    await seed_conversion_chain()
    const records = await grade_trades({ lid: LID })

    const by_trade = new Map()
    for (const record of records) {
      if (!by_trade.has(record.trade_uid)) by_trade.set(record.trade_uid, [])
      by_trade.get(record.trade_uid).push(record)
    }
    expect(by_trade.size).to.be.greaterThan(0)

    // null mirrors null -- a withheld figure is withheld from both sides. But
    // an ABSENT field is null on both sides too, so a bare null-mirrors-null
    // rule passes vacuously against an engine that emits none of these at all.
    const mirrors = (a, b) => {
      if (a === undefined || b === undefined) return false
      if (a === null || b === null) return a === b
      return a === -b
    }

    for (const [trade_uid, pair] of by_trade) {
      expect(pair.length).to.equal(2)
      const [first, second] = pair
      for (const field of [
        'net_value_at_trade',
        'net_value_still_held',
        'net_value_proceeds',
        'net_value_proceeds_change'
      ]) {
        expect(
          mirrors(first[field], second[field]),
          `trade ${trade_uid} is not sign-inverted on ${field}: ${first[field]} against ${second[field]}`
        ).to.equal(true)
      }
    }
  })

  it('labels and describes every state it emits', async () => {
    await seed_conversion_chain()
    const records = await grade_trades({ lid: LID })
    const emitted = new Set(
      records
        .flatMap((record) => [...record.acquired_assets, ...record.sent_assets])
        .map((asset) => asset.team_asset_state)
    )
    expect(emitted.size).to.be.greaterThan(
      0,
      'no state was emitted, so nothing below is tested'
    )

    for (const state of emitted) {
      expect(format_lineage.team_asset_state_labels || {}).to.have.property(
        state
      )
      expect(
        format_lineage.team_asset_state_descriptions || {}
      ).to.have.property(state)
    }

    // The maps must cover the closed set the engine declares, not merely the
    // states this fixture happens to produce.
    expect(
      Object.keys(format_lineage.team_asset_state_labels || {}).sort()
    ).to.deep.equal([...TEAM_ASSET_STATES].sort())
    expect(
      Object.keys(format_lineage.team_asset_state_descriptions || {}).sort()
    ).to.deep.equal([...TEAM_ASSET_STATES].sort())
  })
})
