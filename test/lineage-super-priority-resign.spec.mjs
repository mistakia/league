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
import { epoch_to_timestamptz } from '#libs-shared'

process.env.NODE_ENV = 'test'
const expect = chai.expect
chai.should()
const { regular_season_start } = current_season

const LID = 1
const ORIGINAL_TID = 1
const POACHING_TID = 2
const ORIGINAL_SALARY = 4

describe('LINEAGE - super priority resign', function () {
  let player
  let origin_timestamp
  let poach_timestamp
  let release_timestamp
  let exercise_timestamp

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
    origin_timestamp = now - 28 * 24 * 60 * 60
    poach_timestamp = now - 21 * 24 * 60 * 60
    release_timestamp = now - 14 * 24 * 60 * 60
    exercise_timestamp = now - 7 * 24 * 60 * 60
  })

  // Seed the poach -> release -> super-priority exercise. `origin_types` are
  // the transactions that put the player on the original team's practice squad
  // in the first place; they determine the salary basis the exercise restores.
  const seed_sequence = async ({ origin_types }) => {
    const origin_rows = origin_types.map((type, index) => ({
      pid: player.pid,
      tid: ORIGINAL_TID,
      lid: LID,
      type,
      player_salary: ORIGINAL_SALARY,
      season_year: current_season.year,
      occurred_at: epoch_to_timestamptz(origin_timestamp + index),
      week: current_season.week,
      user_id: 1
    }))

    await knex('transactions').insert([
      ...origin_rows,
      {
        pid: player.pid,
        tid: POACHING_TID,
        lid: LID,
        type: transaction_types.POACHED,
        player_salary: 10,
        season_year: current_season.year,
        occurred_at: epoch_to_timestamptz(poach_timestamp),
        week: current_season.week,
        user_id: 2
      },
      {
        pid: player.pid,
        tid: POACHING_TID,
        lid: LID,
        type: transaction_types.ROSTER_RELEASE,
        player_salary: 10,
        season_year: current_season.year,
        occurred_at: epoch_to_timestamptz(release_timestamp),
        week: current_season.week,
        user_id: 2
      },
      {
        pid: player.pid,
        tid: ORIGINAL_TID,
        lid: LID,
        type: transaction_types.SUPER_PRIORITY,
        // process-super-priority.mjs resolves this from the last
        // PRACTICE_ADD / DRAFT / ROSTER_DEACTIVATE on the original team.
        player_salary: ORIGINAL_SALARY,
        season_year: current_season.year,
        occurred_at: epoch_to_timestamptz(exercise_timestamp),
        week: current_season.week,
        user_id: 1
      }
    ])
  }

  // The walker reads the whole league, so narrow its output to this player.
  const walk = async () => {
    const { holding_drafts, transformation_drafts, coverage_warnings } =
      await walk_transactions({ lid: LID })
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
    const resign = player_holdings.find(
      (draft) =>
        draft.tid === ORIGINAL_TID &&
        draft.period_start.getTime() === exercise_timestamp * 1000
    )
    return { player_holdings, player_edges, coverage_warnings, resign }
  }

  describe('holdings', function () {
    beforeEach(async () => {
      await seed_sequence({ origin_types: [transaction_types.PRACTICE_ADD] })
    })

    it('opens a holding on the original team at the exercise timestamp', async () => {
      const { player_holdings, resign } = await walk()

      const original_team_holdings = player_holdings.filter(
        (draft) => draft.tid === ORIGINAL_TID
      )
      expect(original_team_holdings).to.have.length(2)

      // The poach closes the pre-poach holding as an inter-team move.
      const [pre_poach] = original_team_holdings
      expect(pre_poach.period_start.getTime()).to.equal(origin_timestamp * 1000)
      expect(pre_poach.period_end.getTime()).to.equal(poach_timestamp * 1000)
      expect(pre_poach.terminated_by).to.equal(TERMINATED_BY.TRADE)

      expect(resign.period_end).to.equal(null)
      expect(resign.terminated_by).to.equal(TERMINATED_BY.STILL_HELD)
      expect(resign.salary_paid).to.equal(ORIGINAL_SALARY)
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
        exercise_timestamp * 1000
      )
    })

    it('emits one type-17 edge from the released holding to the new holding', async () => {
      const { player_holdings, player_edges, coverage_warnings, resign } =
        await walk()

      const super_priority_edges = player_edges.filter(
        (edge) =>
          edge.transformation_type === TRANSFORMATION_TYPE.SUPER_PRIORITY_RESIGN
      )
      expect(super_priority_edges).to.have.length(1)

      const [edge] = super_priority_edges
      const released = player_holdings.find(
        (draft) => draft.tid === POACHING_TID
      )
      expect(edge.source_draft_id).to.equal(released.draft_id)
      expect(edge.target_draft_id).to.equal(resign.draft_id)
      expect(edge.source_share).to.equal(1.0)
      expect(edge.target_share).to.equal(1.0)
      expect(edge.occurred_at.getTime()).to.equal(exercise_timestamp * 1000)

      expect(coverage_warnings.super_priority_no_released_holding).to.equal(
        undefined
      )
    })
  })

  // The restored holding carries the basis the player was on before the poach,
  // not an unconditional PS rate. ROSTER_DEACTIVATE copies the salary forward
  // untouched, so the amount and the basis can come from different events.
  describe('restored salary basis', function () {
    const assert_basis = async ({ origin_types, expected_basis }) => {
      await seed_sequence({ origin_types })
      const { resign, coverage_warnings } = await walk()

      expect(resign.salary_basis).to.equal(expected_basis)
      expect(resign.salary_paid).to.equal(ORIGINAL_SALARY)
      expect(
        coverage_warnings.super_priority_resign_no_pre_poach_holding
      ).to.equal(undefined)
    }

    it('restores the PS rate for a practice squad signing', async () => {
      await assert_basis({
        origin_types: [transaction_types.PRACTICE_ADD],
        expected_basis: SALARY_BASIS.PS_SALARY
      })
    })

    it('restores the rookie contract for a drafted rookie', async () => {
      await assert_basis({
        origin_types: [transaction_types.DRAFT],
        expected_basis: SALARY_BASIS.ROOKIE_CONTRACT
      })
    })

    it('restores the auction basis for a signing demoted to the practice squad', async () => {
      await assert_basis({
        origin_types: [
          transaction_types.ROSTER_ADD,
          transaction_types.ROSTER_DEACTIVATE
        ],
        expected_basis: SALARY_BASIS.AUCTION
      })
    })
  })
})
