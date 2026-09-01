/* global describe before beforeEach it */
import * as chai from 'chai'
import fs from 'fs'
import { spawn } from 'child_process'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season, transaction_types } from '#constants'
import { Roster } from '#libs-shared'
import { getRoster, getLeague } from '#libs-server'
import Auction from '#api/sockets/auction.mjs'
import { get_active_auction_nomination } from '#libs-server/auction-settlement.mjs'
import {
  LEAGUE_SCOPED_TABLES,
  CLONED_BOARD_TABLES,
  parse_league_scoped_tables,
  parent_table_for,
  parent_key_for,
  resolve_scope,
  build_scope_plan,
  count_league_rows,
  diff_counts,
  wipe_order,
  wipe_league,
  clone_league_metadata,
  clone_league_board,
  clone_league
} from '#libs-server/clone-league.mjs'
import { selectPlayer } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const source_lid = 1
const season_year = current_season.year
const roster_week = 0

describe('clone-league', function () {
  describe('the table set', function () {
    it('uses the same pattern as the coverage gate, compared as source', function () {
      // The clone duplicates the gate's regex because the gate is a SCRIPT: it
      // runs on import AND calls process.exit on failure, so importing it from a
      // spec would kill the whole mocha run mid-suite and read as a hang rather
      // than a failure. I did import it at first; this is the repair.
      //
      // So the drift check reads the gate's SOURCE and compares the pattern
      // literal rather than executing anything. If either side edits its regex,
      // this fails and names the divergence.
      const gate_source = fs.readFileSync(
        'db/gates/check-league-fixture-reset-coverage.mjs',
        'utf8'
      )
      const clone_source = fs.readFileSync(
        'libs-server/clone-league.mjs',
        'utf8'
      )

      const pattern_of = (source) => {
        const match = source.match(/const re = (\/\(\?:knex.*?\/g)\n/)
        expect(match, 'reset-list pattern not found').to.not.equal(null)
        return match[1]
      }

      expect(pattern_of(clone_source)).to.equal(pattern_of(gate_source))
    })

    it('picks up a newly added league-scoped table with no edit', function () {
      // The property that makes this derived rather than restated.
      const synthetic = `
        export default async function reset_league_tables(knex) {
          await knex('transactions').del()
          await knex('a_table_added_tomorrow').del()
        }
      `
      expect(parse_league_scoped_tables(synthetic)).to.include(
        'a_table_added_tomorrow'
      )
    })

    it('carries both auction tables', function () {
      expect(LEAGUE_SCOPED_TABLES).to.include('auction_elections')
      expect(LEAGUE_SCOPED_TABLES).to.include('auction_block_opt_ins')
    })
  })

  describe('scoping a table to one league', function () {
    // Driven with a SYNTHETIC schema rather than the real one, because each
    // case has to isolate the tier under test. A real table carries several
    // scoping columns at once, so a case built on one cannot say which tier
    // answered -- the resolver would look right while choosing for the wrong
    // reason.
    const scoped_tables = ['waivers', 'waiver_releases', 'poaches', 'teams']

    it('prefers a league column over a team column', function () {
      expect(
        resolve_scope({
          table: 'waivers',
          columns: ['waiver_id', 'tid', 'lid'],
          scoped_tables
        })
      ).to.deep.equal({ tier: 'league', column: 'lid' })
    })

    it('falls to the team column when there is no league column', function () {
      expect(
        resolve_scope({
          table: 'users_teams',
          columns: ['user_id', 'tid', 'season_year'],
          scoped_tables
        })
      ).to.deep.equal({ tier: 'team', column: 'tid' })
    })

    it('reaches a parent row id when the table carries neither', function () {
      expect(
        resolve_scope({
          table: 'waiver_releases',
          columns: ['waiver_id', 'pid'],
          scoped_tables,
          columns_by_table: { waivers: ['waiver_id', 'lid'] }
        })
      ).to.deep.equal({
        tier: 'parent',
        column: 'waiver_id',
        parent: 'waivers',
        parent_key: 'waiver_id'
      })
    })

    it('resolves a parent key spelled differently from the child column', function () {
      // restricted_free_agency_releases.restricted_free_agency_bid_id points at
      // restricted_free_agency_bids.bid_id. Assuming the two names match scopes
      // the delete on a column the parent does not have.
      expect(
        parent_key_for({
          column: 'restricted_free_agency_bid_id',
          parent_columns: ['bid_id', 'pid', 'tid', 'lid']
        })
      ).to.equal('bid_id')
    })

    it('does not mistake a table for its own parent', function () {
      expect(
        parent_table_for({
          column: 'admission_vote_candidate_id',
          table: 'admission_vote_candidates',
          scoped_tables: ['admission_vote_candidates', 'admission_votes']
        })
      ).to.equal(null)
    })

    it('clears a grandchild before the parent it is scoped through', function () {
      // The reset list runs parent-before-child. A scoped delete cannot: once
      // `waivers` is empty the subquery that reaches `waiver_releases` matches
      // nothing and the grandchild survives a wipe that reports success.
      const plan = {
        waivers: { tier: 'league', column: 'lid' },
        waiver_releases: {
          tier: 'parent',
          column: 'waiver_id',
          parent: 'waivers',
          parent_key: 'waiver_id'
        },
        users_teams: { tier: 'team', column: 'tid' },
        teams: { tier: 'league', column: 'lid' }
      }
      const order = wipe_order(plan)
      expect(order.indexOf('waiver_releases')).to.be.lessThan(
        order.indexOf('waivers')
      )
      expect(order.indexOf('users_teams')).to.be.lessThan(
        order.indexOf('teams')
      )
    })

    it('orders the real table set the same way', function () {
      // The synthetic case above proves the rule; this proves the rule reaches
      // every table the clone actually wipes.
      const plan = {}
      for (const table of LEAGUE_SCOPED_TABLES) {
        plan[table] = { tier: 'league', column: 'lid' }
      }
      plan.waiver_releases = {
        tier: 'parent',
        column: 'waiver_id',
        parent: 'waivers',
        parent_key: 'waiver_id'
      }
      plan.poach_releases = {
        tier: 'parent',
        column: 'poach_id',
        parent: 'poaches',
        parent_key: 'poach_id'
      }
      const order = wipe_order(plan)
      expect(order).to.have.length(LEAGUE_SCOPED_TABLES.length)
      expect(order.indexOf('waiver_releases')).to.be.lessThan(
        order.indexOf('waivers')
      )
      expect(order.indexOf('poach_releases')).to.be.lessThan(
        order.indexOf('poaches')
      )
      // The foreign key ordering the reset list encodes is preserved for
      // tables with no scoping relation between them.
      expect(order.indexOf('roster_asset_transformation')).to.be.lessThan(
        order.indexOf('roster_asset_holding')
      )
    })

    it('throws rather than scoping a table it cannot key', function () {
      // The fail-loud direction. A resolver that returned null here would leave
      // the table unwiped and report a clean run.
      expect(() =>
        resolve_scope({
          table: 'mystery',
          columns: ['pid', 'week'],
          scoped_tables
        })
      ).to.throw('cannot scope mystery')
    })
  })

  describe('the league 1 refusal', function () {
    it('refuses to wipe league 1, with no flag to override', async function () {
      // The whole safety property of this script. A mistyped --to must not be
      // able to clear the live league.
      let error = null
      try {
        await wipe_league({ trx: knex, lid: 1 })
      } catch (err) {
        error = err
      }

      expect(error).to.not.equal(null)
      expect(error.message).to.include('refusing to wipe league 1')
    })

    it('refuses to clone into league 1', async function () {
      let error = null
      try {
        await clone_league_board({
          trx: knex,
          from_lid: 2,
          to_lid: 1,
          season_year
        })
      } catch (err) {
        error = err
      }

      expect(error).to.not.equal(null)
      expect(error.message).to.include('refusing to clone into league 1')
    })

    it('refuses a wipe with no explicit lid', async function () {
      let error = null
      try {
        await wipe_league({ trx: knex, lid: undefined })
      } catch (err) {
        error = err
      }

      expect(error).to.not.equal(null)
      expect(error.message).to.include('explicit lid')
    })
  })

  describe('against the database', function () {
    this.timeout(60 * 1000)

    before(async function () {
      this.timeout(60 * 1000)
      MockDate.set(
        current_season.regular_season_start.subtract('1', 'month').toISOString()
      )
      await knex.seed.run()
    })

    // Three rostered players at DISTINCT salaries, so a cloned team's
    // availableCap is a value only a correct copy produces. With the bare
    // fixture every roster is empty and every team's availableCap is the salary
    // cap, which cannot tell a working clone from one that copies no players at
    // all.
    //
    // The salary transaction is dated to the PRIOR season on purpose. That is
    // where a real league's salaries live -- a player signed in an earlier year
    // has his transaction in that year -- and it is the case that distinguishes
    // copying the whole transaction history from copying only the current
    // season.
    const seeded = []

    const seed_roster = async () => {
      seeded.length = 0
      const exclude_pids = []
      for (const { tid, player_salary } of [
        { tid: 1, player_salary: 25 },
        { tid: 2, player_salary: 40 },
        { tid: 3, player_salary: 5 }
      ]) {
        const player = await selectPlayer({ exclude_pids, random: false })
        exclude_pids.push(player.pid)

        const roster = await knex('rosters')
          .where({ tid, lid: source_lid, season_year, week: roster_week })
          .first()

        await knex('rosters_players').insert({
          roster_id: roster.roster_id,
          slot: 0,
          pid: player.pid,
          player_position: player.pos || 'RB',
          tid,
          lid: source_lid,
          week: roster_week,
          season_year
        })

        await knex('transactions').insert({
          user_id: tid,
          tid,
          pid: player.pid,
          lid: source_lid,
          type: transaction_types.AUCTION_PROCESSED,
          player_salary,
          week: roster_week,
          season_year: season_year - 1,
          occurred_at: new Date()
        })

        seeded.push({ tid, pid: player.pid, player_salary })
      }
    }

    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
      await seed_roster()
    })

    const board_of = async ({ lid }) => {
      const league_row = await getLeague({ lid, year: season_year })
      const teams = await knex('teams')
        .where({ lid, season_year })
        .orderBy('draft_order')

      const board = []
      for (const team of teams) {
        const roster_row = await getRoster({
          tid: team.team_id,
          week: roster_week,
          year: season_year
        })
        const roster = new Roster({ roster: roster_row, league: league_row })
        board.push({
          name: team.name,
          draft_order: team.draft_order,
          salary_cap: team.salary_cap,
          free_agent_acquisition_budget_balance:
            team.free_agent_acquisition_budget_balance,
          player_count: roster.all.length,
          availableCap: roster.availableCap,
          availableSpace: roster.availableSpace
        })
      }
      return board
    }

    it('copies the board so every team matches the source', async function () {
      const source_board = await board_of({ lid: source_lid })
      expect(source_board).to.have.length(12)
      // The input has to be able to fail. If no team carries a player, every
      // availableCap below is the bare salary cap and the assertion is vacuous.
      expect(
        source_board.filter((team) => team.player_count > 0)
      ).to.have.length(3)
      expect(
        new Set(source_board.map((team) => team.availableCap)).size
      ).to.be.greaterThan(1)

      const { lid } = await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, season_year })
      )
      expect(lid).to.not.equal(source_lid)

      expect(await board_of({ lid })).to.deep.equal(source_board)
    })

    it('gives the copy new team ids', async function () {
      const source_ids = new Set(
        (await knex('teams').where({ lid: source_lid })).map((t) => t.team_id)
      )

      const { lid } = await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, season_year })
      )

      const cloned = await knex('teams').where({ lid, season_year })
      expect(cloned).to.have.length(12)
      for (const team of cloned) {
        expect(source_ids.has(team.team_id)).to.equal(false)
      }
    })

    it('is hosted and reaches no Discord channel', async function () {
      // Asserted rather than assumed: a test auction announcing its nominations
      // into the real league's channel is the loudest way to get this wrong.
      await knex('leagues').where({ league_id: source_lid }).update({
        discord_webhook_url: 'https://discord.example/source',
        discord_announcements_webhook_url: 'https://discord.example/announce'
      })

      const { lid } = await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, season_year })
      )

      const cloned = await knex('leagues').where({ league_id: lid }).first()
      expect(cloned.discord_webhook_url).to.equal(null)
      expect(cloned.discord_announcements_webhook_url).to.equal(null)
      expect(cloned.is_hosted).to.equal(true)
    })

    it('carries the salary history but not the current auction', async function () {
      // Both halves at once, because they pull opposite ways and a clone that
      // drops all transactions passes either one alone.
      await knex('transactions').insert({
        user_id: 1,
        tid: 1,
        pid: seeded[0].pid,
        lid: source_lid,
        type: transaction_types.AUCTION_BID,
        player_salary: 3,
        week: roster_week,
        season_year,
        occurred_at: new Date()
      })

      const { lid } = await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, season_year })
      )

      const auction_rows = await knex('transactions')
        .where({ lid, season_year })
        .whereIn('type', [
          transaction_types.AUCTION_BID,
          transaction_types.AUCTION_PROCESSED
        ])
      expect(auction_rows).to.have.length(0)

      const history = await knex('transactions').where({
        lid,
        season_year: season_year - 1
      })
      expect(history).to.have.length(3)
    })

    it('lets the same users reach the copy', async function () {
      const { lid } = await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, season_year })
      )

      const cloned_tids = (await knex('teams').where({ lid, season_year })).map(
        (team) => team.team_id
      )
      const owners = await knex('users_teams')
        .whereIn('tid', cloned_tids)
        .where({ season_year })
      expect(owners.map((row) => row.user_id).sort()).to.deep.equal(
        (
          await knex('users_teams')
            .whereIn(
              'tid',
              (await knex('teams').where({ lid: source_lid, season_year })).map(
                (team) => team.team_id
              )
            )
            .where({ season_year })
        )
          .map((row) => row.user_id)
          .sort()
      )
    })

    it('leaves the source unwritten across a full run', async function () {
      const plan = await build_scope_plan({ trx: knex })
      const before_counts = await count_league_rows({
        trx: knex,
        lid: source_lid,
        plan
      })
      // The oracle has to be able to move, or an unchanged source proves
      // nothing about it.
      expect(before_counts.teams).to.equal(12)
      expect(before_counts.rosters_players).to.equal(3)
      expect(before_counts.waiver_releases).to.equal(0)

      const { lid } = await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, season_year })
      )
      await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, to_lid: lid, season_year })
      )

      const after_counts = await count_league_rows({
        trx: knex,
        lid: source_lid,
        plan
      })
      expect(diff_counts(before_counts, after_counts)).to.deep.equal([])
    })

    it('re-syncs to the same state, twice over', async function () {
      const { lid } = await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, season_year })
      )

      // A live auction's worth of writes on the copy, which the re-sync has to
      // clear. Without them the second run has nothing to undo and the
      // comparison cannot fail.
      const cloned_team = await knex('teams')
        .where({ lid, season_year })
        .orderBy('draft_order')
        .first()
      await knex('transactions').insert({
        user_id: 1,
        tid: cloned_team.team_id,
        pid: seeded[0].pid,
        lid,
        type: transaction_types.AUCTION_BID,
        player_salary: 11,
        week: roster_week,
        season_year,
        occurred_at: new Date()
      })
      await knex('league_pauses').insert({
        league_id: lid,
        paused_at: new Date(),
        pause_reason: 'clone-league re-sync spec',
        paused_by_user_id: 1
      })

      const plan = await build_scope_plan({ trx: knex })
      const dirty = await count_league_rows({ trx: knex, lid, plan })
      expect(dirty.league_pauses).to.equal(1)

      await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, to_lid: lid, season_year })
      )
      const first = await board_of({ lid })
      const first_counts = await count_league_rows({ trx: knex, lid, plan })
      expect(first_counts.league_pauses).to.equal(0)

      await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, to_lid: lid, season_year })
      )
      const second = await board_of({ lid })
      const second_counts = await count_league_rows({ trx: knex, lid, plan })

      expect(second).to.deep.equal(first)
      expect(diff_counts(first_counts, second_counts)).to.deep.equal([])
    })

    it('keeps the copy reachable after a re-sync', async function () {
      // The wipe clears `leagues` and `seasons` too -- they are league-scoped
      // and the reset list names them. A sync that did not put them back left
      // the target league id pointing at nothing, which reads as a successful
      // sync until someone opens the page.
      const { lid } = await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, season_year })
      )
      await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, to_lid: lid, season_year })
      )

      const cloned = await knex('leagues').where({ league_id: lid }).first()
      expect(cloned, 'the leagues row survived the re-sync').to.not.equal(
        undefined
      )
      const season = await knex('seasons').where({ lid, season_year }).first()
      expect(season, 'the seasons row survived the re-sync').to.not.equal(
        undefined
      )
      expect((await getLeague({ lid, year: season_year })).salary_cap).to.equal(
        (await getLeague({ lid: source_lid, year: season_year })).salary_cap
      )
    })

    it('wipes a grandchild table that carries no league key', async function () {
      // waiver_releases is scoped only through waivers.waiver_id. The tier that
      // reaches it is the one a column-name rule alone would miss.
      const { lid } = await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, season_year })
      )
      const [waiver] = await knex('waivers')
        .insert({
          user_id: 1,
          pid: seeded[0].pid,
          tid: (await knex('teams').where({ lid, season_year }).first())
            .team_id,
          lid,
          type: 1,
          bid_amount: 1,
          submitted: new Date()
        })
        .returning('waiver_id')
      await knex('waiver_releases').insert({
        waiver_id: waiver.waiver_id,
        pid: seeded[1].pid
      })
      expect(
        await knex('waiver_releases').where({ waiver_id: waiver.waiver_id })
      ).to.have.length(1)

      await knex.transaction((trx) => wipe_league({ trx, lid }))

      expect(
        await knex('waiver_releases').where({ waiver_id: waiver.waiver_id })
      ).to.have.length(0)
    })

    it('refuses to clone a league into itself', async function () {
      let error = null
      try {
        await knex.transaction((trx) =>
          clone_league({
            trx,
            from_lid: source_lid,
            to_lid: source_lid,
            season_year
          })
        )
      } catch (err) {
        error = err
      }
      expect(error).to.not.equal(null)
      expect(error.message).to.include('into itself')
    })

    it('reports a source write instead of committing it', async function () {
      // The negative control for the source-unwritten assertion: a run that DID
      // write the source must be reported and rolled back. Nothing in
      // clone_league writes the source, so the write is injected here.
      let error = null
      try {
        await knex.transaction(async (trx) => {
          const result = await clone_league_metadata({
            trx,
            from_lid: source_lid
          })
          // One row, named explicitly. `.limit(1)` on a delete is ignored by
          // postgres, so the same line written that way clears all twelve and
          // the assertion below reads 12 -> 0.
          await trx('teams').where({ lid: source_lid, team_id: 12 }).del()
          const plan = await build_scope_plan({ trx })
          const before = { teams: 12 }
          const after = await count_league_rows({
            trx,
            lid: source_lid,
            plan
          })
          const drift = diff_counts(before, after)
          if (drift.length) {
            throw new Error(`source league was written: ${drift.join(', ')}`)
          }
          return result
        })
      } catch (err) {
        error = err
      }

      expect(error).to.not.equal(null)
      expect(error.message).to.include('teams: 12 -> 11')
      // Rolled back, so the source still has its twelve teams.
      expect(
        await knex('teams').where({ lid: source_lid, season_year })
      ).to.have.length(12)
    })
  })

  describe('the shape league 1 actually has', function () {
    this.timeout(60 * 1000)

    // The shared fixture builds ONE season. League 1 does not: measured
    // read-only against production, it carries eight team-years, twelve
    // distinct team ids of which only ten are in the current season, seven
    // `seasons` rows, and twelve thousand transactions spread across those
    // years. Every one of those differences exercises a branch the
    // single-season fixture cannot reach, and the team-identity branch below
    // does not run AT ALL against it.
    const prior_years = [season_year - 1, season_year - 2]
    const retired_team_ids = [13, 14]

    before(async function () {
      this.timeout(60 * 1000)
      MockDate.set(
        current_season.regular_season_start.subtract('1', 'month').toISOString()
      )
      await knex.seed.run()
    })

    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)

      const current_teams = await knex('teams').where({
        lid: source_lid,
        season_year
      })

      // The same twelve teams in two earlier years, so one team is several
      // rows, plus two that folded and appear ONLY in those earlier years.
      const team_rows = []
      const users_teams_rows = []
      for (const year of prior_years) {
        for (const team of current_teams) {
          const { team_id, ...rest } = team
          team_rows.push({ ...rest, team_id, season_year: year })
          users_teams_rows.push({
            user_id: team_id,
            tid: team_id,
            season_year: year
          })
        }
        for (const team_id of retired_team_ids) {
          team_rows.push({
            team_id,
            season_year: year,
            lid: source_lid,
            division: 1,
            name: `Retired${team_id}`,
            abbreviation: `RT${team_id}`,
            waiver_order: team_id,
            draft_order: team_id,
            salary_cap: current_teams[0].salary_cap,
            free_agent_acquisition_budget_balance: 0
          })
          users_teams_rows.push({
            user_id: team_id,
            tid: team_id,
            season_year: year
          })
        }
      }
      await knex('teams').insert(team_rows)
      await knex('users_teams').insert(users_teams_rows)

      // A transaction in an earlier year belonging to a team that no longer
      // exists in the current season. `map_tid` throws on an unmapped tid, so
      // this is the case that says whether the clone reaches historical teams
      // or dies on them.
      const player = await selectPlayer({ random: false })
      await knex('transactions').insert({
        user_id: 13,
        tid: 13,
        pid: player.pid,
        lid: source_lid,
        type: transaction_types.ROSTER_ADD,
        player_salary: 7,
        week: 0,
        season_year: prior_years[0],
        occurred_at: new Date()
      })
    })

    it('gives one source team one cloned id across every year it played', async function () {
      const source_teams = await knex('teams').where({ lid: source_lid })
      expect(source_teams).to.have.length(12 * 3 + 4)
      expect(new Set(source_teams.map((t) => t.team_id)).size).to.equal(14)

      const { lid } = await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, season_year })
      )

      const cloned = await knex('teams').where({ lid })
      expect(cloned).to.have.length(source_teams.length)
      expect(new Set(cloned.map((t) => t.team_id)).size).to.equal(14)

      // The property that a row-at-a-time insert breaks: one team is one id in
      // every year, so a name appears under exactly one cloned team_id.
      const ids_by_name = new Map()
      for (const team of cloned) {
        if (!ids_by_name.has(team.name)) ids_by_name.set(team.name, new Set())
        ids_by_name.get(team.name).add(team.team_id)
      }
      for (const [name, ids] of ids_by_name) {
        expect(
          ids.size,
          `${name} was split across ${ids.size} cloned ids`
        ).to.equal(1)
      }
    })

    it('carries a transaction belonging to a team that has since folded', async function () {
      const { lid } = await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, season_year })
      )

      const retired_clone = await knex('teams')
        .where({ lid, name: 'Retired13' })
        .first()
      expect(retired_clone, 'the folded team was cloned').to.not.equal(
        undefined
      )

      const carried = await knex('transactions').where({
        lid,
        tid: retired_clone.team_id,
        season_year: prior_years[0]
      })
      expect(carried).to.have.length(1)
      expect(carried[0].player_salary).to.equal(7)
    })

    it('leaves only the current season on the board the auction reads', async function () {
      const { lid } = await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, season_year })
      )

      // `_load_teams` filters on the current season, so the folded teams must
      // not appear on the board however many historical rows they have.
      const board = await knex('teams').where({ lid, season_year })
      expect(board).to.have.length(12)
      expect(board.map((t) => t.name)).to.not.include('Retired13')
    })

    it('re-syncs a multi-season league to the same state', async function () {
      const { lid } = await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, season_year })
      )
      const plan = await build_scope_plan({ trx: knex })

      await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, to_lid: lid, season_year })
      )
      const first = await count_league_rows({ trx: knex, lid, plan })
      await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, to_lid: lid, season_year })
      )
      const second = await count_league_rows({ trx: knex, lid, plan })

      expect(first.teams).to.equal(12 * 3 + 4)
      expect(diff_counts(first, second)).to.deep.equal([])
    })
  })

  describe('what a re-sync must not overwrite', function () {
    this.timeout(60 * 1000)

    // The auction mirror differs from league 1 on purpose, and the differences
    // ARE the reason it exists: election mode on, free agency period already
    // open. League 1 has election mode off and a period that opens days from
    // now. A sync that re-copied the source's season row would turn the mirror
    // off and push its period into the future, and the next election would be
    // refused with nothing in the sync's output saying why.
    before(async function () {
      this.timeout(60 * 1000)
      MockDate.set(
        current_season.regular_season_start.subtract('1', 'month').toISOString()
      )
      await knex.seed.run()
    })

    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
      // The source's own settings, deliberately the OPPOSITE of the mirror's on
      // both columns. Without this the source and target agree and the test
      // cannot tell preserving from overwriting.
      await knex('seasons').where({ lid: source_lid, season_year }).update({
        is_auction_election_mode_enabled: false,
        free_agency_period_start: current_season.regular_season_start.toDate()
      })
    })

    const make_mirror = async () => {
      const { lid } = await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, season_year })
      )
      const period_start = current_season.regular_season_start
        .subtract(2, 'months')
        .toDate()
      await knex('seasons').where({ lid, season_year }).update({
        is_auction_election_mode_enabled: true,
        free_agency_period_start: period_start
      })
      return { lid, period_start }
    }

    it('keeps the mirror in election mode with its period still open', async function () {
      const { lid, period_start } = await make_mirror()

      const result = await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, to_lid: lid, season_year })
      )
      expect(result.configuration_preserved).to.equal(true)

      const season = await knex('seasons').where({ lid, season_year }).first()
      expect(season.is_auction_election_mode_enabled).to.equal(true)
      expect(season.free_agency_period_start.getTime()).to.equal(
        period_start.getTime()
      )
    })

    it('names the columns where the mirror and the source disagree', async function () {
      const { lid } = await make_mirror()

      const result = await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, to_lid: lid, season_year })
      )

      expect(result.configuration_drift).to.include(
        `${season_year}.is_auction_election_mode_enabled`
      )
      expect(result.configuration_drift).to.include(
        `${season_year}.free_agency_period_start`
      )

      // The report is computed from the configuration captured BEFORE the wipe,
      // so on its own it would still read correct even if the sync then wrote
      // the source's values over the top. Confirm against what the database
      // actually holds afterwards, or the report is a claim about an
      // intermediate value nobody can observe.
      const [target, source] = await Promise.all([
        knex('seasons').where({ lid, season_year }).first(),
        knex('seasons').where({ lid: source_lid, season_year }).first()
      ])
      for (const column of [
        'is_auction_election_mode_enabled',
        'free_agency_period_start'
      ]) {
        expect(
          String(target[column]),
          `${column} still differs from the source after the sync`
        ).to.not.equal(String(source[column]))
      }
    })

    it('still re-copies the board while keeping the settings', async function () {
      // Preserving configuration must not turn into preserving everything --
      // the board is exactly what a sync is for.
      const { lid } = await make_mirror()
      await knex('teams').where({ lid, season_year }).del()
      expect(await knex('teams').where({ lid, season_year })).to.have.length(0)

      await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, to_lid: lid, season_year })
      )

      expect(await knex('teams').where({ lid, season_year })).to.have.length(12)
    })

    it('copies the source settings when the target does not exist yet', async function () {
      // --sync into a league id nothing has created. There is no configuration
      // to preserve, so the source's is the only sensible answer.
      const result = await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, to_lid: 4242, season_year })
      )
      expect(result.lid).to.equal(4242)
      expect(result.configuration_preserved).to.equal(false)

      const season = await knex('seasons')
        .where({ lid: 4242, season_year })
        .first()
      expect(season, 'a seasons row was created').to.not.equal(undefined)
      expect(season.is_auction_election_mode_enabled).to.equal(false)
    })
  })

  describe('reporting what it is doing', function () {
    this.timeout(60 * 1000)

    // The first production run wrote correctly and was killed anyway: it printed
    // nothing for 26 minutes, and this repository's own rule says a run silent
    // for over a minute should be TREATED as a hang. Correct writes nobody can
    // wait through are not a working script.
    before(async function () {
      this.timeout(60 * 1000)
      MockDate.set(
        current_season.regular_season_start.subtract('1', 'month').toISOString()
      )
      await knex.seed.run()
    })

    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
    })

    it('reports progress for every table it copies', async function () {
      const events = []
      await knex.transaction((trx) =>
        clone_league({
          trx,
          from_lid: source_lid,
          season_year,
          on_progress: (event) => events.push(event)
        })
      )

      // Every copied table has to appear, or a silent one is exactly the stall
      // the operator cannot distinguish from a hang.
      const tables = new Set(events.filter((e) => e.table).map((e) => e.table))
      for (const table of CLONED_BOARD_TABLES) {
        expect(tables.has(table), `no progress reported for ${table}`).to.equal(
          true
        )
      }
      expect(events.some((e) => e.phase === 'wipe')).to.equal(false)
      expect(events.some((e) => e.phase === 'verify-source')).to.equal(true)
    })

    it('reports the wipe as well on a re-sync', async function () {
      const { lid } = await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, season_year })
      )

      const events = []
      await knex.transaction((trx) =>
        clone_league({
          trx,
          from_lid: source_lid,
          to_lid: lid,
          season_year,
          on_progress: (event) => events.push(event)
        })
      )

      const wipe_events = events.filter((e) => e.phase === 'wipe')
      expect(wipe_events.length).to.be.greaterThan(0)
      expect(wipe_events[wipe_events.length - 1].copied).to.equal(
        LEAGUE_SCOPED_TABLES.length
      )
    })

    it('counts every row it claims to have copied', async function () {
      // The batched insert returns its own count rather than the length of the
      // list it was handed, so a batch that silently inserted fewer rows cannot
      // be reported as a full copy. Checked against the database, not the
      // return value alone.
      const { copied } = await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, season_year })
      )
      const { lid } = await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, season_year })
      )
      expect(copied.users_teams).to.equal(12)

      expect(
        await knex('users_teams').whereIn(
          'tid',
          (await knex('teams').where({ lid })).map((t) => t.team_id)
        )
      ).to.have.length(copied.users_teams)
    })

    it('copies a row count that spans several batches', async function () {
      // 500 rows to a batch, so the single-batch path is the only one the other
      // specs reach. Seed past the boundary and the multi-batch path -- the one
      // production actually takes with 12,195 transactions -- runs too.
      const player = await selectPlayer({ random: false })
      const rows = []
      for (let index = 0; index < 620; index++) {
        rows.push({
          user_id: 1,
          tid: 1,
          pid: player.pid,
          lid: source_lid,
          type: transaction_types.ROSTER_ADD,
          player_salary: 1,
          week: 0,
          season_year: season_year - 1,
          occurred_at: new Date()
        })
      }
      await knex.batchInsert('transactions', rows, 200)

      const { lid, copied } = await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, season_year })
      )

      // 620 rows at 500 to a batch is two batches, and the count is the batched
      // insert's own tally rather than the length of the list handed to it.
      expect(copied.transactions).to.equal(620)
      expect(
        await knex('transactions').where({ lid, season_year: season_year - 1 })
      ).to.have.length(620)
    })
  })

  describe('the auction reading the copy', function () {
    this.timeout(60 * 1000)

    before(async function () {
      this.timeout(60 * 1000)
      MockDate.set(
        current_season.regular_season_start.subtract('1', 'month').toISOString()
      )
      await knex.seed.run()
    })

    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
    })

    it('rotates nominations in the source league draft order', async function () {
      // The claim the whole clone rests on: `_load_teams` sorts on draft_order
      // and `_tids` IS the nomination rotation, so a copy that lost the order
      // nominates in an arbitrary sequence and the walk proves nothing.
      //
      // Driven through the real Auction object rather than a re-implementation
      // of its query, because a re-implementation cannot tell whether the SOCKET
      // agrees with the clone.
      const source_auction = new Auction({ wss: null, lid: source_lid })
      await source_auction._load_teams()
      expect(source_auction._tids).to.have.length(12)

      const { lid } = await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, season_year })
      )

      const clone_auction = new Auction({ wss: null, lid })
      await clone_auction._load_teams()

      expect(clone_auction._tids).to.have.length(12)
      expect(clone_auction._teams.map((t) => t.draft_order)).to.deep.equal(
        source_auction._teams.map((t) => t.draft_order)
      )
      expect(clone_auction._teams.map((t) => t.name)).to.deep.equal(
        source_auction._teams.map((t) => t.name)
      )
      // A different league, so different ids -- the ORDER is what carries.
      expect(clone_auction._tids).to.not.deep.equal(source_auction._tids)
    })

    it('opens on a clean board rather than resuming the source auction', async function () {
      // Mid-auction on the source: a nomination the socket would resume from.
      const player = await selectPlayer({ random: false })
      await knex('transactions').insert({
        user_id: 1,
        tid: 1,
        pid: player.pid,
        lid: source_lid,
        type: transaction_types.AUCTION_BID,
        player_salary: 4,
        week: 0,
        season_year,
        occurred_at: new Date()
      })
      expect(
        await get_active_auction_nomination({ lid: source_lid, season_year })
      ).to.not.equal(null)

      const { lid } = await knex.transaction((trx) =>
        clone_league({ trx, from_lid: source_lid, season_year })
      )

      const clone_auction = new Auction({ wss: null, lid })
      await clone_auction._load_teams()
      await clone_auction._load_transactions()
      expect(clone_auction._transactions).to.have.length(0)
      expect(
        await get_active_auction_nomination({ lid, season_year })
      ).to.equal(null)
    })
  })

  describe('the command line', function () {
    this.timeout(120 * 1000)

    // The specs above all call the library. Nothing had ever run the SCRIPT,
    // so its argument wiring, its season, its transaction and its exit codes
    // were unexercised -- and the script is the only surface the operator
    // touches.
    const run_cli = (args) =>
      new Promise((resolve) => {
        const child = spawn('node', ['scripts/clone-league.mjs', ...args], {
          env: process.env
        })
        let stdout = ''
        let stderr = ''
        child.stdout.on('data', (chunk) => {
          stdout += chunk
        })
        child.stderr.on('data', (chunk) => {
          stderr += chunk
        })
        child.on('close', (code) => resolve({ code, stdout, stderr }))
      })

    const lid_from = (stdout) => {
      const match = stdout.match(/created league (\d+) from league/)
      expect(match, `no created league in output:\n${stdout}`).to.not.equal(
        null
      )
      return Number(match[1])
    }

    before(async function () {
      this.timeout(60 * 1000)
      MockDate.set(
        current_season.regular_season_start.subtract('1', 'month').toISOString()
      )
      await knex.seed.run()
    })

    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
    })

    it('creates a league end to end', async function () {
      const before_leagues = (await knex('leagues')).length

      const { code, stdout, stderr } = await run_cli([
        '--create',
        '--from',
        '1',
        '--execute'
      ])
      expect(code, `stderr:\n${stderr}`).to.equal(0)

      const lid = lid_from(stdout)
      expect(lid).to.not.equal(source_lid)
      expect(await knex('leagues')).to.have.length(before_leagues + 1)
      expect(await knex('teams').where({ lid, season_year })).to.have.length(12)
      expect(stdout).to.include('copied teams: 12')
    })

    it('writes nothing without --execute', async function () {
      // A dry run that quietly wrote would be the worst defect this script
      // could carry, because the whole safety story is "look before you leap".
      const before_leagues = (await knex('leagues')).length
      const before_teams = (await knex('teams')).length

      const { code, stdout } = await run_cli(['--create', '--from', '1'])
      expect(code).to.equal(0)
      expect(stdout).to.include('DRY RUN')

      expect(await knex('leagues')).to.have.length(before_leagues)
      expect(await knex('teams')).to.have.length(before_teams)
    })

    it('re-syncs from the command line and clears what the auction wrote', async function () {
      const created = await run_cli(['--create', '--from', '1', '--execute'])
      expect(created.code, created.stderr).to.equal(0)
      const lid = lid_from(created.stdout)

      const player = await selectPlayer({ random: false })
      const cloned_team = await knex('teams')
        .where({ lid, season_year })
        .first()
      await knex('transactions').insert({
        user_id: 1,
        tid: cloned_team.team_id,
        pid: player.pid,
        lid,
        type: transaction_types.AUCTION_BID,
        player_salary: 9,
        week: 0,
        season_year,
        occurred_at: new Date()
      })

      const synced = await run_cli([
        '--sync',
        '--from',
        '1',
        '--to',
        String(lid),
        '--execute'
      ])
      expect(synced.code, synced.stderr).to.equal(0)
      expect(synced.stdout).to.include(`synced league 1 -> league ${lid}`)

      expect(
        await knex('transactions')
          .where({ lid, season_year })
          .whereIn('type', [
            transaction_types.AUCTION_BID,
            transaction_types.AUCTION_PROCESSED
          ])
      ).to.have.length(0)
      expect(await knex('teams').where({ lid, season_year })).to.have.length(12)
    })

    it('refuses --to 1 with a non-zero exit and touches nothing', async function () {
      const before_teams = (
        await knex('teams').where({ lid: source_lid, season_year })
      ).length
      expect(before_teams).to.equal(12)

      const { code, stderr } = await run_cli([
        '--sync',
        '--from',
        '2',
        '--to',
        '1',
        '--execute'
      ])
      expect(code).to.equal(1)
      expect(stderr).to.include('refusing --to 1')

      expect(
        await knex('teams').where({ lid: source_lid, season_year })
      ).to.have.length(12)
    })

    it('exits non-zero on an unknown argument rather than guessing', async function () {
      const { code, stderr } = await run_cli([
        '--create',
        '--from',
        '1',
        '--exceute'
      ])
      expect(code).to.equal(1)
      expect(stderr).to.include('unknown argument')
    })
  })
})
