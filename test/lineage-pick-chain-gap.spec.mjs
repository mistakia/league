/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season } from '#constants'
import { epoch_to_timestamptz } from '#libs-shared'
import walk_transactions from '#libs-server/roster-asset-lineage/walk-transactions.mjs'
import { ASSET_TYPE } from '#libs-server/roster-asset-lineage/constants.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const LID = 1
const PICK_YEAR = current_season.year + 2

// The pick chain is walked forward from `draft.original_team_id` across a pick's accepted
// trades, which assumes trades_picks records every hop that moved it. League 1
// has three 2026 picks where it does not: the chain reaches a trade whose two
// teams do not include the holder, and walking forward from that holder emitted
// a leg naming a team the trade never involved (view_trade_asset_flow.from_tid
// on trades 234, 247, 287 and 300). The tell in production is a ~60-second
// ownership window synthesized for the pick's original owner immediately before
// the trade.
//
// These fixtures reproduce the three shapes the walker must distinguish: a gap
// before a pick's first trade (repairable, because only the synthetic endowment
// precedes it), a gap mid-chain (direction repairable, holding continuity not),
// and an intact chain that must be left exactly as it was.
describe('LINEAGE - pick chain gap', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    MockDate.set(
      current_season.regular_season_start.subtract('1', 'month').toISOString()
    )
    await league(knex)
  })

  const insert_pick = async ({
    draft_pick_id,
    original_team_id,
    tid,
    round
  }) => {
    await knex('draft').insert({
      draft_pick_id,
      lid: LID,
      season_year: PICK_YEAR,
      round,
      tid,
      original_team_id
    })
  }

  const insert_trade = async ({
    trade_id,
    propose_tid,
    accept_tid,
    accepted,
    draft_pick_id,
    recorded_tid
  }) => {
    await knex('trades').insert({
      trade_id,
      lid: LID,
      propose_tid,
      accept_tid,
      user_id: 1,
      season_year: current_season.year,
      // `accepted` is a Date now, so `accepted - 1` would be milliseconds.
      offered: new Date(accepted.getTime() - 1000),
      accepted
    })
    await knex('trades_picks').insert({
      trade_id,
      tid: recorded_tid,
      draft_pick_id
    })
  }

  const walk_pick = async ({ draft_pick_id }) => {
    const { holding_drafts, transformation_drafts, coverage_warnings } =
      await walk_transactions({ lid: LID })
    const holdings = holding_drafts
      .filter(
        (draft) =>
          draft.asset_type === ASSET_TYPE.PICK &&
          draft.draft_pick_id === draft_pick_id
      )
      .sort((a, b) => a.period_start - b.period_start)
    const holding_by_draft_id = new Map(
      holdings.map((holding) => [holding.draft_id, holding])
    )
    const legs = transformation_drafts
      .filter((edge) => holding_by_draft_id.has(edge.target_draft_id))
      .filter((edge) => edge.trade_id)
      .sort((a, b) => a.occurred_at - b.occurred_at)
      .map((edge) => ({
        trade_id: edge.trade_id,
        from_tid: holding_by_draft_id.get(edge.source_draft_id)?.tid ?? null,
        to_tid: holding_by_draft_id.get(edge.target_draft_id).tid
      }))
    return { holdings, legs, coverage_warnings }
  }

  const now = () => Math.round(Date.now() / 1000)

  it('retargets the endowment when the chain breaks before the first trade', async function () {
    this.timeout(60 * 1000)
    // Team 3 is endowed the pick but team 1 is the team that trades it away, so
    // the hop that moved it from 3 to 1 is missing from trades_picks.
    await insert_pick({
      draft_pick_id: 1,
      original_team_id: 3,
      tid: 2,
      round: 1
    })
    await insert_trade({
      trade_id: 1,
      propose_tid: 1,
      accept_tid: 2,
      accepted: epoch_to_timestamptz(now() - 7 * 24 * 60 * 60),
      draft_pick_id: 1,
      recorded_tid: 1
    })

    const { holdings, legs, coverage_warnings } = await walk_pick({
      draft_pick_id: 1
    })

    expect(holdings.length).to.equal(2)
    expect(holdings[0].tid).to.equal(1)
    // The standings fact is untouched -- only the holder of the synthesized
    // pre-trade window moves.
    expect(holdings[0].pick_original_owner_tid).to.equal(3)
    expect(legs).to.deep.equal([{ trade_id: 1, from_tid: 1, to_tid: 2 }])
    expect(coverage_warnings.pick_chain_gap_before_first_trade).to.equal(1)
    expect(coverage_warnings.trade_leg_source_not_participant).to.equal(
      undefined
    )
  })

  it('leaves an intact chain alone', async function () {
    this.timeout(60 * 1000)
    await insert_pick({
      draft_pick_id: 2,
      original_team_id: 4,
      tid: 5,
      round: 2
    })
    await insert_trade({
      trade_id: 2,
      propose_tid: 4,
      accept_tid: 5,
      accepted: epoch_to_timestamptz(now() - 7 * 24 * 60 * 60),
      draft_pick_id: 2,
      recorded_tid: 4
    })

    const { holdings, legs, coverage_warnings } = await walk_pick({
      draft_pick_id: 2
    })

    expect(holdings.length).to.equal(2)
    expect(holdings[0].tid).to.equal(4)
    expect(legs).to.deep.equal([{ trade_id: 2, from_tid: 4, to_tid: 5 }])
    expect(coverage_warnings.pick_chain_gap_before_first_trade).to.equal(
      undefined
    )
    expect(coverage_warnings.pick_chain_gap_mid_chain).to.equal(undefined)
    expect(coverage_warnings.trade_leg_source_not_participant).to.equal(
      undefined
    )
    expect(coverage_warnings.pick_chain_end_state_mismatch).to.equal(undefined)
  })

  it('flags a chain that does not land on draft.tid', async function () {
    this.timeout(60 * 1000)
    // Every hop is recorded and every leg names the trade's own two teams, so
    // none of the gap warnings fire -- but the chain ends on team 4 while
    // draft.tid says team 5 holds the pick. That is the signature of a draft_pick_id
    // pointed at the wrong team's pick: the identity and the trade history
    // disagree about ownership, and only the end state exposes it.
    await insert_pick({
      draft_pick_id: 5,
      original_team_id: 3,
      tid: 5,
      round: 2
    })
    await insert_trade({
      trade_id: 6,
      propose_tid: 3,
      accept_tid: 4,
      accepted: epoch_to_timestamptz(now() - 7 * 24 * 60 * 60),
      draft_pick_id: 5,
      recorded_tid: 3
    })

    const { legs, coverage_warnings } = await walk_pick({ draft_pick_id: 5 })

    expect(legs).to.deep.equal([{ trade_id: 6, from_tid: 3, to_tid: 4 }])
    expect(coverage_warnings.pick_chain_end_state_mismatch).to.equal(1)
    expect(coverage_warnings.pick_chain_gap_before_first_trade).to.equal(
      undefined
    )
    expect(coverage_warnings.pick_chain_gap_mid_chain).to.equal(undefined)
    expect(coverage_warnings.pick_chain_gap_unresolved).to.equal(undefined)
  })

  it('repairs direction but not holding continuity on a mid-chain gap', async function () {
    this.timeout(60 * 1000)
    // First trade is intact (6 -> 7); the second is between two teams that
    // never received the pick, so nothing but a synthetic hop could put its
    // source holding on a participant. Direction is still recovered from the
    // recorded trades_picks.tid, and the oracle counts the leg that is left.
    await insert_pick({
      draft_pick_id: 3,
      original_team_id: 6,
      tid: 9,
      round: 3
    })
    await insert_trade({
      trade_id: 3,
      propose_tid: 6,
      accept_tid: 7,
      accepted: epoch_to_timestamptz(now() - 14 * 24 * 60 * 60),
      draft_pick_id: 3,
      recorded_tid: 6
    })
    await insert_trade({
      trade_id: 4,
      propose_tid: 8,
      accept_tid: 9,
      accepted: epoch_to_timestamptz(now() - 7 * 24 * 60 * 60),
      draft_pick_id: 3,
      recorded_tid: 8
    })

    const { legs, coverage_warnings } = await walk_pick({ draft_pick_id: 3 })

    expect(legs[0]).to.deep.equal({ trade_id: 3, from_tid: 6, to_tid: 7 })
    expect(legs[1].trade_id).to.equal(4)
    expect(legs[1].to_tid).to.equal(9)
    expect(coverage_warnings.pick_chain_gap_mid_chain).to.equal(1)
    expect(coverage_warnings.trade_leg_source_not_participant).to.equal(1)
  })

  it('falls back to the proposing team when the recorded tid is no help', async function () {
    this.timeout(60 * 1000)
    // Neither the chain holder (10) nor the recorded trades_picks.tid (12) is
    // in the trade, so the giver cannot be recovered -- but the leg must still
    // name only the trade's own two teams.
    await insert_pick({
      draft_pick_id: 4,
      original_team_id: 10,
      tid: 11,
      round: 1
    })
    await insert_trade({
      trade_id: 5,
      propose_tid: 1,
      accept_tid: 11,
      accepted: epoch_to_timestamptz(now() - 7 * 24 * 60 * 60),
      draft_pick_id: 4,
      recorded_tid: 12
    })

    const { legs, coverage_warnings } = await walk_pick({ draft_pick_id: 4 })

    expect(legs).to.deep.equal([{ trade_id: 5, from_tid: 1, to_tid: 11 }])
    expect(coverage_warnings.pick_chain_gap_unresolved).to.equal(1)
    expect(coverage_warnings.trade_leg_source_not_participant).to.equal(
      undefined
    )
  })
})
