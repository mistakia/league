/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season, transaction_types } from '#constants'
import walk_transactions from '#libs-server/roster-asset-lineage/walk-transactions.mjs'
import {
  ASSET_TYPE,
  SALARY_BASIS,
  TERMINATED_BY,
  TRANSFORMATION_TYPE
} from '#libs-server/roster-asset-lineage/constants.mjs'
import { selectPlayer } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect
chai.should()
const { regular_season_start } = current_season

const ORIGINAL_TID = 1
const POACHING_TID = 2
const PS_SALARY_VALUE = 4
const SUPER_PRIORITY_VALUE = 6

describe('LINEAGE - super priority resign', function () {
  const lid = 1
  let player
  let ps_add_timestamp
  let poach_timestamp
  let release_timestamp
  let super_priority_timestamp

  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
    await league(knex)

    player = await selectPlayer({ rookie: false })

    const now = Math.round(Date.now() / 1000)
    ps_add_timestamp = now - 28 * 24 * 60 * 60
    poach_timestamp = now - 21 * 24 * 60 * 60
    release_timestamp = now - 14 * 24 * 60 * 60
    super_priority_timestamp = now - 7 * 24 * 60 * 60

    // Poach -> release -> super-priority exercise on a single player. The
    // walker reads the whole league's transactions, so every assertion below
    // filters the resulting drafts down to this player.
    await knex('transactions').insert([
      {
        pid: player.pid,
        tid: ORIGINAL_TID,
        lid,
        type: transaction_types.PRACTICE_ADD,
        value: PS_SALARY_VALUE,
        year: current_season.year,
        timestamp: ps_add_timestamp,
        week: current_season.week,
        userid: 1
      },
      {
        pid: player.pid,
        tid: POACHING_TID,
        lid,
        type: transaction_types.POACHED,
        value: 10,
        year: current_season.year,
        timestamp: poach_timestamp,
        week: current_season.week,
        userid: 2
      },
      {
        pid: player.pid,
        tid: POACHING_TID,
        lid,
        type: transaction_types.ROSTER_RELEASE,
        value: 10,
        year: current_season.year,
        timestamp: release_timestamp,
        week: current_season.week,
        userid: 2
      },
      {
        pid: player.pid,
        tid: ORIGINAL_TID,
        lid,
        type: transaction_types.SUPER_PRIORITY,
        value: SUPER_PRIORITY_VALUE,
        year: current_season.year,
        timestamp: super_priority_timestamp,
        week: current_season.week,
        userid: 1
      }
    ])
  })

  const walk = async () => {
    const { holding_drafts, transformation_drafts, coverage_warnings } =
      await walk_transactions({ lid })
    const player_holdings = holding_drafts
      .filter(
        (draft) =>
          draft.asset_type === ASSET_TYPE.PLAYER &&
          draft.player_id === player.pid
      )
      .sort((a, b) => a.period_start - b.period_start)
    const player_holding_ids = new Set(
      player_holdings.map((draft) => draft.draft_id)
    )
    const player_edges = transformation_drafts.filter(
      (edge) =>
        player_holding_ids.has(edge.source_draft_id) ||
        player_holding_ids.has(edge.target_draft_id)
    )
    return { player_holdings, player_edges, coverage_warnings }
  }

  it('opens a holding on the original team at the exercise timestamp', async () => {
    const { player_holdings } = await walk()

    const original_team_holdings = player_holdings.filter(
      (draft) => draft.tid === ORIGINAL_TID
    )
    expect(original_team_holdings).to.have.length(2)

    const [pre_poach, resign] = original_team_holdings

    // The poach closes the pre-poach holding as an inter-team move.
    expect(pre_poach.period_start.getTime()).to.equal(ps_add_timestamp * 1000)
    expect(pre_poach.period_end.getTime()).to.equal(poach_timestamp * 1000)
    expect(pre_poach.terminated_by).to.equal(TERMINATED_BY.TRADE)

    expect(resign.period_start.getTime()).to.equal(
      super_priority_timestamp * 1000
    )
    expect(resign.period_end).to.equal(null)
    expect(resign.terminated_by).to.equal(TERMINATED_BY.STILL_HELD)
    expect(resign.salary_basis).to.equal(SALARY_BASIS.PS_SALARY)
    expect(resign.salary_paid).to.equal(SUPER_PRIORITY_VALUE)
  })

  it('closes the poacher holding by release and stamps super_priority_until', async () => {
    const { player_holdings } = await walk()

    const poacher_holdings = player_holdings.filter(
      (draft) => draft.tid === POACHING_TID
    )
    expect(poacher_holdings).to.have.length(1)

    const [released] = poacher_holdings
    expect(released.period_start.getTime()).to.equal(poach_timestamp * 1000)
    expect(released.period_end.getTime()).to.equal(release_timestamp * 1000)
    expect(released.terminated_by).to.equal(TERMINATED_BY.RELEASE)
    expect(released.super_priority_until.getTime()).to.equal(
      super_priority_timestamp * 1000
    )
  })

  it('emits one type-17 edge from the released holding to the new holding', async () => {
    const { player_holdings, player_edges, coverage_warnings } = await walk()

    const super_priority_edges = player_edges.filter(
      (edge) =>
        edge.transformation_type === TRANSFORMATION_TYPE.SUPER_PRIORITY_RESIGN
    )
    expect(super_priority_edges).to.have.length(1)

    const [edge] = super_priority_edges
    const released = player_holdings.find((draft) => draft.tid === POACHING_TID)
    const resign = player_holdings.find(
      (draft) =>
        draft.tid === ORIGINAL_TID &&
        draft.period_start.getTime() === super_priority_timestamp * 1000
    )

    expect(edge.source_draft_id).to.equal(released.draft_id)
    expect(edge.target_draft_id).to.equal(resign.draft_id)
    expect(edge.source_share).to.equal(1.0)
    expect(edge.target_share).to.equal(1.0)
    expect(edge.occurred_at.getTime()).to.equal(super_priority_timestamp * 1000)

    expect(coverage_warnings.super_priority_no_released_holding).to.equal(
      undefined
    )
  })
})
