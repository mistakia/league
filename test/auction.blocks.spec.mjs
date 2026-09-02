/* global describe before beforeEach afterEach it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'
import dayjs from 'dayjs'

import server from '#api'
import knex from '#db'
import league from '#db/fixtures/league.mjs'
import {
  current_season,
  roster_slot_types,
  transaction_types
} from '#constants'
import {
  set_auction_block_opt_in,
  evaluate_auction_block_finalization,
  get_finalized_auction_blocks,
  get_block_eligible_team_ids
} from '#libs-server/auction-blocks.mjs'
import { format_block_convened_message } from '#libs-server/format-auction-discord-message.mjs'
import { user1, user2 } from './fixtures/token.mjs'

process.env.NODE_ENV = 'test'
chai.use(chai_http)
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// BLOCK CONVENING, DRIVEN RATHER THAN READ.
//
// Every defect this subsystem has produced was found by executing the behavior
// and none by reading the source, and the two REST verbs that shipped before
// this returned 500 against their own OpenAPI blocks because no spec had ever
// called them. So the opt-in path here goes through the ROUTE, not through the
// library behind it.
describe('auction live blocks', function () {
  // The whole free agency period sits in the future relative to the mocked
  // clock, which is what lets a slot be both inside the period and far enough
  // ahead to clear the notice threshold.
  let period_start
  let period_end
  let now

  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  afterEach(function () {
    MockDate.reset()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    now = current_season.regular_season_start.subtract(1, 'month')
    MockDate.set(now.toISOString())
    await league(knex)

    period_start = now.subtract(1, 'hour')
    period_end = now.add(5, 'day')

    await knex('seasons').where({ lid: league_id, season_year }).update({
      free_agency_period_start: period_start.toDate(),
      free_agency_period_end: period_end.toDate(),
      auction_block_notice_minutes: 60
    })
  })

  const slot_at = (hours_from_now) =>
    now.add(hours_from_now, 'hour').minute(0).second(0).millisecond(0)

  const eligible_tids = () => get_block_eligible_team_ids({ lid: league_id })

  const opt_in_over_rest = ({ teamId, block_at, is_opted_in = true, token }) =>
    chai_request
      .execute(server)
      .post(`/api/leagues/${league_id}/auction-blocks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ teamId, block_at: block_at.unix(), is_opted_in })

  // Opt in every eligible team but one over the LIBRARY, so the single opt-in
  // under test is the one that completes unanimity. The route is exercised on
  // that last one, which is the call the assertion depends on.
  const opt_in_all_but = async ({ block_at, except_tid }) => {
    for (const tid of await eligible_tids()) {
      if (tid === except_tid) continue
      await set_auction_block_opt_in({
        lid: league_id,
        tid,
        user_id: 1,
        block_at,
        is_opted_in: true
      })
    }
  }

  describe('the routes', function () {
    it('returns the schedule with the computed final block', async function () {
      const res = await chai_request
        .execute(server)
        .get(`/api/leagues/${league_id}/auction-blocks`)
        .set('Authorization', `Bearer ${user1}`)

      expect(res.status, JSON.stringify(res.body)).to.equal(200)
      expect(res.body.blocks).to.be.an('array').that.is.empty
      expect(res.body.opt_ins).to.be.an('array').that.is.empty
      expect(res.body.eligible_team_ids).to.be.an('array')
      // The final block is the design's only termination guarantee, so a
      // schedule that cannot state it is a schedule the auction cannot end on.
      expect(res.body.final_block_at).to.be.a('number')
      expect(res.body.final_block_at).to.be.at.most(res.body.period_end)
    })

    it('refuses a team acting for another team', async function () {
      const res = await opt_in_over_rest({
        teamId: 1,
        block_at: slot_at(4),
        token: user2
      })
      expect(res.status).to.equal(400)
    })

    it('refuses a slot that is not on the granularity boundary', async function () {
      const res = await opt_in_over_rest({
        teamId: 1,
        block_at: slot_at(4).add(7, 'minute'),
        token: user1
      })
      expect(res.status).to.equal(400)
      expect(res.body.error).to.match(/boundary/)
    })

    it('refuses a slot outside the free agency period', async function () {
      const res = await opt_in_over_rest({
        teamId: 1,
        block_at: period_end.add(1, 'day').minute(0).second(0).millisecond(0),
        token: user1
      })
      expect(res.status).to.equal(400)
      expect(res.body.error).to.match(/outside the free agency period/)
    })

    it('records an opt-in and reports it by name', async function () {
      const block_at = slot_at(4)
      const res = await opt_in_over_rest({
        teamId: 1,
        block_at,
        token: user1
      })

      expect(res.status, JSON.stringify(res.body)).to.equal(200)
      expect(res.body.block_at).to.equal(block_at.unix())

      const slot = res.body.opt_ins.find(
        (entry) => entry.block_at === block_at.unix()
      )
      expect(slot, 'the slot appears in the schedule').to.exist
      // NAMED, NOT COUNTED. A manager cannot argue for a slot against a bare
      // count -- they need to see who is already there and who is missing.
      expect(slot.opt_in_tids).to.deep.equal([1])
      expect(slot.is_finalized).to.equal(false)
    })
  })

  describe('convening', function () {
    it('finalizes on unanimity among teams with an open active spot', async function () {
      this.timeout(60 * 1000)
      const block_at = slot_at(4)
      await opt_in_all_but({ block_at, except_tid: 1 })

      const before = await get_finalized_auction_blocks({ lid: league_id })
      expect(before, 'not unanimous yet').to.have.length(0)

      const res = await opt_in_over_rest({ teamId: 1, block_at, token: user1 })
      expect(res.status, JSON.stringify(res.body)).to.equal(200)

      expect(res.body.blocks).to.have.length(1)
      expect(res.body.blocks[0].block_at).to.equal(block_at.unix())
      expect(res.body.blocks[0].end_at).to.equal(
        block_at.add(15, 'minute').unix()
      )
      // The frozen denominator: how many teams held an open active spot at the
      // moment unanimity was reached.
      expect(res.body.blocks[0].eligible_team_count).to.equal(
        (await eligible_tids()).length
      )
    })

    it('lapses rather than firing when unanimity lands inside the notice threshold', async function () {
      this.timeout(60 * 1000)
      // Thirty minutes out against a sixty-minute notice threshold. Opting into
      // a block is agreeing to ATTEND, so nobody is pulled into a live auction
      // on half an hour's warning.
      const block_at = now.add(30, 'minute').minute(30).second(0).millisecond(0)

      for (const tid of await eligible_tids()) {
        await set_auction_block_opt_in({
          lid: league_id,
          tid,
          user_id: 1,
          block_at,
          is_opted_in: true
        })
      }

      const blocks = await get_finalized_auction_blocks({ lid: league_id })
      expect(
        blocks,
        'unanimity inside the threshold must lapse'
      ).to.have.length(0)
    })

    it('keeps a block finalized when a further team becomes eligible', async function () {
      this.timeout(60 * 1000)
      const block_at = slot_at(4)

      // Fill one team's active roster so it is OUT of the denominator, then
      // convene on the remaining teams.
      const [full_team] = await knex('teams')
        .where({ lid: league_id, season_year })
        .orderBy('team_id')
      // The roster `Roster` reads, which is the CURRENT fantasy week rather than
      // week 0 -- a fill written against week 0 is invisible to the eligibility
      // predicate and the team stays in the denominator.
      const roster = await knex('rosters')
        .where({
          tid: full_team.team_id,
          week: current_season.fantasy_season_week,
          season_year
        })
        .first()
      expect(roster, 'the fixture builds the current-week roster').to.exist

      const filler = await knex('player')
        .whereNot('current_nfl_team', 'INA')
        .whereNotIn(
          'pid',
          await knex('rosters_players').where({ lid: league_id }).pluck('pid')
        )
        .limit(300)

      // Fill to the active-roster limit so `availableSpace` reaches zero. Each
      // filler needs a TRANSACTION as well as a roster row: `getRoster` inner
      // joins the salary-in-force transaction, so a roster row with none behind
      // it is dropped and the fill is silently a no-op. That is the same join
      // that makes an auction signing visible to eligibility, so filling this
      // way is the mechanism rather than an imitation of it.
      let inserted = 0
      for (const player of filler) {
        const spots = await get_block_eligible_team_ids({ lid: league_id })
        if (!spots.includes(full_team.team_id)) break
        await knex('transactions').insert({
          user_id: 1,
          tid: full_team.team_id,
          pid: player.pid,
          lid: league_id,
          type: transaction_types.AUCTION_PROCESSED,
          player_salary: 0,
          week: 0,
          season_year,
          occurred_at: new Date()
        })
        await knex('rosters_players').insert({
          roster_id: roster.roster_id,
          slot: roster_slot_types.BENCH,
          player_position: player.primary_position,
          pid: player.pid,
          extensions: 0,
          tid: full_team.team_id,
          lid: league_id,
          season_year,
          week: roster.week
        })
        inserted += 1
      }
      expect(inserted, 'filled the team to its active limit').to.be.above(0)

      const denominator_before = await eligible_tids()
      expect(
        denominator_before,
        'the filled team leaves the denominator'
      ).to.not.include(full_team.team_id)

      for (const tid of denominator_before) {
        await set_auction_block_opt_in({
          lid: league_id,
          tid,
          user_id: 1,
          block_at,
          is_opted_in: true
        })
      }

      const finalized = await get_finalized_auction_blocks({ lid: league_id })
      expect(finalized, 'convened on the then-eligible set').to.have.length(1)
      expect(finalized[0].eligible_team_count).to.equal(
        denominator_before.length
      )

      // Now free a spot on the excluded team, which is what a trade does. The
      // eligible set grows and the block must NOT un-finalize -- today's rosters
      // cannot answer what the set WAS, which is why finalization is recorded.
      const [freed] = await knex('rosters_players')
        .where({ roster_id: roster.roster_id })
        .whereNot('slot', roster_slot_types.PS)
        .limit(1)
      await knex('rosters_players')
        .where({ roster_id: roster.roster_id, pid: freed.pid })
        .del()

      const denominator_after = await eligible_tids()
      expect(denominator_after.length).to.be.above(denominator_before.length)

      await evaluate_auction_block_finalization({ lid: league_id })
      const still = await get_finalized_auction_blocks({ lid: league_id })
      expect(still, 'the block stays finalized').to.have.length(1)
      expect(still[0].block_id).to.equal(finalized[0].block_id)
      expect(still[0].eligible_team_count).to.equal(denominator_before.length)
    })

    it('does not cancel a finalized block when a team withdraws', async function () {
      this.timeout(60 * 1000)
      const block_at = slot_at(4)
      await opt_in_all_but({ block_at, except_tid: 1 })
      await opt_in_over_rest({ teamId: 1, block_at, token: user1 })

      const res = await opt_in_over_rest({
        teamId: 1,
        block_at,
        is_opted_in: false,
        token: user1
      })

      expect(res.status, JSON.stringify(res.body)).to.equal(200)
      expect(
        res.body.blocks,
        'the block survives the withdrawal'
      ).to.have.length(1)
      const slot = res.body.opt_ins.find(
        (entry) => entry.block_at === block_at.unix()
      )
      expect(
        slot.opt_in_tids,
        'the withdrawn team is gone from the slot'
      ).to.not.include(1)
    })

    // A BLOCK IS FINALIZED AND ANNOUNCED, and the announcement is the half that
    // reaches a manager who is not sitting on the page. Every other event in
    // this design waits for someone who happens to be looking; a block is the
    // one that requires them to SHOW UP.
    //
    // The announcer is injected rather than stubbed, because the defect this
    // guards is a one-line call at the end of a loop never running -- and this
    // subsystem has already lost a Discord message exactly that way.
    it('announces a block once when it convenes', async function () {
      this.timeout(60 * 1000)
      const block_at = slot_at(4)
      const announced = []

      for (const tid of await eligible_tids()) {
        await set_auction_block_opt_in({
          lid: league_id,
          tid,
          user_id: 1,
          block_at,
          is_opted_in: true
        })
      }

      // Re-evaluating must NOT announce again: the block is already finalized,
      // and a schedule read runs this on every request.
      await evaluate_auction_block_finalization({
        lid: league_id,
        announce: async (args) => announced.push(args)
      })

      expect(
        await get_finalized_auction_blocks({ lid: league_id }),
        'the block convened'
      ).to.have.length(1)
      expect(
        announced,
        'an already-finalized block is not re-announced'
      ).to.have.length(0)
    })

    it('announces an extension as an extension, not a second block', async function () {
      this.timeout(60 * 1000)
      const first = slot_at(4)
      const second = first.add(15, 'minute')
      const announced = []
      const collect = async (args) => {
        announced.push(args)
        return null
      }

      for (const tid of await eligible_tids()) {
        await set_auction_block_opt_in({
          lid: league_id,
          tid,
          user_id: 1,
          block_at: first,
          is_opted_in: true
        })
      }
      // Opt everyone into the adjacent slot with the opt-in path's own
      // evaluation suppressed, so the announcement under test comes from one
      // deliberate evaluation rather than from whichever write happened last.
      await knex('auction_block_opt_ins').insert(
        (await eligible_tids()).map((tid) => ({
          lid: league_id,
          season_year,
          tid,
          user_id: 1,
          block_at: second.toDate(),
          opted_in_at: new Date()
        }))
      )

      await evaluate_auction_block_finalization({
        lid: league_id,
        announce: collect
      })

      expect(announced, 'the merge announces once').to.have.length(1)
      const message = await format_block_convened_message({
        block_at: announced[0].block.block_at,
        end_at: announced[0].block.end_at,
        eligible_team_count: announced[0].block.eligible_team_count,
        is_extension: Boolean(announced[0].block.merged_slot_at)
      })
      // Consecutive unanimous slots run as ONE session, so telling the league a
      // second block has convened would be telling them something false.
      expect(message).to.match(/EXTENDED/)
      // Two consecutive 15-minute slots make a 30-minute SESSION, which is the
      // number a manager plans attendance around.
      expect(message).to.match(/30 minutes/)
    })

    it('runs consecutive unanimous blocks as one session', async function () {
      this.timeout(60 * 1000)
      const first = slot_at(4)
      const second = first.add(15, 'minute')

      for (const block_at of [first, second]) {
        for (const tid of await eligible_tids()) {
          await set_auction_block_opt_in({
            lid: league_id,
            tid,
            user_id: 1,
            block_at,
            is_opted_in: true
          })
        }
      }

      const blocks = await get_finalized_auction_blocks({ lid: league_id })
      // ONE session, not two rows. Block duration is whatever the league opted
      // into rather than a configured value.
      expect(blocks).to.have.length(1)
      expect(dayjs(blocks[0].block_at).unix()).to.equal(first.unix())
      expect(dayjs(blocks[0].end_at).unix()).to.equal(
        second.add(15, 'minute').unix()
      )
    })
  })
})
