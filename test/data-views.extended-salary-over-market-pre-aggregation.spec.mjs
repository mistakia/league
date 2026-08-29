/* global describe it before after */

import * as chai from 'chai'

import db from '#db'
import { current_season, player_tag_types } from '#constants'
import { get_data_view_results_query } from '#libs-server/get-data-view-results.mjs'
import {
  market_salary_cte_name,
  roster_tag_cte_name
} from '#libs-server/data-views-column-definitions/player-extended-salary-over-market-column-definitions.mjs'

const { expect } = chai

const year = current_season.year
const lid = 1
const league_format_id = 'genesis_10_team'

// Name the relations under test rather than matching a fragment of anyone's
// SQL. Every other join in these queries also carries a get_table_hash alias,
// so a pattern like /left join "t[0-9a-f]{32}"/ is green whether or not either
// of these is joined -- the extended-salary join alone satisfies it.
const market_cte = market_salary_cte_name({ league_format_id, year })
const roster_cte = roster_tag_cte_name({ lid, year })

// A second real catalog format, for the two-scope cases. The scope lives in the
// relation name, so this must resolve to a different relation than market_cte.
const other_league_format_id = 'ppr'
const other_market_cte = market_salary_cte_name({
  league_format_id: other_league_format_id,
  year
})

const over_market_request = {
  columns: [
    { column_id: 'player_league_extended_salary_over_market' },
    { column_id: 'player_league_extended_salary' }
  ],
  prefix_columns: ['player_name'],
  where: [{ column_id: 'player_position', operator: 'IN', value: ['MLB'] }],
  sort: [],
  offset: 0,
  limit: 100
}

// Both operands were correlated scalar subqueries until 2026-08-29, each
// probed once per outer row: 28,807 loops on production for 86,721 buffers on
// the roster-tag arm alone, against probes already index-only at ~0.003ms. The
// cost was loop count. Pre-aggregated into two relations joined on pid, the
// whole query drops from 93,454 buffers to 10,389.
describe('Data Views - extended salary over market pre-aggregation', function () {
  this.timeout(60 * 1000)

  it('reads both operands from joined relations, not correlated subqueries', async () => {
    const { query } = await get_data_view_results_query(over_market_request)
    const sql = query.toString()

    expect(sql).to.include(`"${roster_cte}" as (`)
    expect(sql).to.include(`"${market_cte}" as (`)
    expect(sql).to.include(`${roster_cte}.tag`)
    expect(sql).to.include(`${market_cte}.market_salary_positive`)

    // The join has to be LEFT on both. On production ~96% of players match no
    // roster row and no market row; an inner join drops every one of them
    // rather than rendering the cell blank. See the seeded spec below for the
    // executed proof -- an inner join is still valid SQL, so a shape assertion
    // is not sufficient on its own.
    expect(sql).to.include(`left join "${roster_cte}" on`)
    expect(sql).to.include(`left join "${market_cte}" on`)

    // The correlated forms this replaced, named exactly so the assertion
    // cannot pass over a partial revert.
    expect(sql).to.not.include('SELECT tag FROM rosters_players WHERE')
    expect(sql).to.not.include(
      'SELECT market_salary_positive FROM league_format_player_season_projection_values'
    )
  })

  // rosters_players is UNIQUE on (pid, week, season_year, tid) and NOT on lid,
  // so the relation's grain is not free -- the de-duplication is what makes it
  // one row per pid. See the seeded fan-out spec below.
  it('de-duplicates the roster relation to one row per player', async () => {
    const { query } = await get_data_view_results_query(over_market_request)
    expect(query.toString()).to.include(
      `select distinct on (pid) pid, tag from rosters_players where lid = ${lid} and season_year = ${year} and week = 0 order by pid, tid`
    )
  })

  it('registers each relation once though select and group by both emit it', async () => {
    const { query } = await get_data_view_results_query(over_market_request)
    const sql = query.toString()

    // main_select, main_group_by and main_where all emit the same expression.
    // Registering a name twice would emit a duplicate WITH alias (42712).
    for (const cte_name of [roster_cte, market_cte]) {
      expect(sql.split(`"${cte_name}" as (`)).to.have.lengthOf(2)
      expect(sql.split(`left join "${cte_name}" on`)).to.have.lengthOf(2)
    }
  })

  it('registers the relations for a where-only use of the column', async () => {
    const { query } = await get_data_view_results_query({
      columns: [],
      prefix_columns: ['player_name'],
      where: [
        {
          column_id: 'player_league_extended_salary_over_market',
          operator: '>',
          value: 0
        }
      ],
      sort: [],
      offset: 0,
      limit: 10
    })
    const sql = query.toString()

    // Unlike the career-year projection this follows, main_where here reads the
    // SAME expression as main_select rather than a stored column, so a
    // where-only use wants both relations too. That is what makes registering
    // on first reference sufficient and a select-vs-where discriminator
    // unnecessary: the filter would reference an undefined alias without them.
    expect(sql).to.include(`"${roster_cte}" as (`)
    expect(sql).to.include(`"${market_cte}" as (`)
    expect(sql).to.include(`left join "${roster_cte}" on`)
    expect(sql).to.include(`left join "${market_cte}" on`)
  })

  // The idempotency guard is a Set keyed by relation NAME rather than a boolean
  // flag, and this is the case that forces it. Two of these columns at
  // different format scopes share one roster relation and need TWO market
  // relations; a flag would register the first and let the second silently READ
  // it, so the second column would price against the wrong format's market
  // salary. Valid SQL, plausible numbers, wrong answer.
  //
  // Necessary but not sufficient on its own -- two relations is what makes two
  // values POSSIBLE, not what makes them different. The executed spec below is
  // the other half.
  it('separates the market relations for two columns at different formats', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        { column_id: 'player_league_extended_salary_over_market' },
        {
          column_id: 'player_league_extended_salary_over_market',
          params: { league_format_id: other_league_format_id }
        }
      ],
      prefix_columns: ['player_name'],
      where: [],
      sort: [],
      offset: 0,
      limit: 10
    })
    const sql = query.toString()

    expect(market_cte).to.not.equal(other_market_cte)
    for (const cte_name of [roster_cte, market_cte, other_market_cte]) {
      expect(sql.split(`"${cte_name}" as (`)).to.have.lengthOf(2)
      expect(sql.split(`left join "${cte_name}" on`)).to.have.lengthOf(2)
    }

    // The roster relation depends on lid and year only, so the two columns
    // share it rather than duplicating it.
    expect([...sql.matchAll(/left join "t[0-9a-f]{32}" on/g)]).to.have.lengthOf(
      3
    )
  })

  describe('executed', function () {
    const rostered_pid = 'TEST-OVMK-000001'
    const unrostered_pid = 'TEST-OVMK-000002'
    const fanout_pid = 'TEST-OVMK-000003'
    let trx

    // Seeded on primary_position MLB and filtered on it, so the fixture
    // corpus's 1,250 players cannot reach these assertions.
    before(async () => {
      trx = await db.transaction()

      const other_mlb = await trx('player')
        .where({ primary_position: 'MLB' })
        .count('* as count')
        .first()
      expect(Number(other_mlb.count)).to.equal(
        0,
        'seeds isolate on MLB; a fixture player claiming it would make these assertions meaningless'
      )

      for (const pid of [rostered_pid, unrostered_pid, fanout_pid]) {
        await trx('player').insert({
          pid,
          first_name: 'Test',
          last_name: pid,
          short_name: 'T.Test',
          formatted_name: `Test ${pid}`,
          primary_position: 'MLB',
          secondary_position: 'MLB',
          date_of_birth: '2000-01-01',
          nfl_draft_year: year,
          current_nfl_team: 'ZWA'
        })
      }

      // Rostered, tagged REGULAR, with a market salary: the arm that produces a
      // number rather than a blank.
      await trx('rosters_players').insert({
        roster_id: 900001,
        slot: 1,
        pid: rostered_pid,
        player_position: 'MLB',
        tag: player_tag_types.REGULAR,
        extensions: 0,
        tid: 9001,
        lid,
        week: 0,
        season_year: year
      })
      await trx('league_format_player_season_projection_values').insert([
        {
          pid: rostered_pid,
          league_format_id,
          season_year: year,
          market_salary_positive: 12.5
        },
        // The fan-out player needs one too, or its rows are NULL for want of a
        // market salary and the de-duplication gate below cannot tell that
        // apart from the blank it exists to catch.
        {
          pid: fanout_pid,
          league_format_id,
          season_year: year,
          market_salary_positive: 10.0
        },
        // Same player, second format, DIFFERENT market salary. Two columns
        // scoped to the two formats must resolve these two numbers and not one
        // of them twice.
        {
          pid: rostered_pid,
          league_format_id: other_league_format_id,
          season_year: year,
          market_salary_positive: 3.0
        }
      ])

      // One player, two week-0 rows in ONE league on two tids. The unique index
      // permits it and production carries such a pair (ZAMI-WHIT-015750, league
      // 1, 2022), which is why the relation needs DISTINCT ON: the correlated
      // form raised 21000 here, and an undeduplicated relation would DUPLICATE
      // the outer player row instead -- valid SQL, silently wrong.
      //
      // The two rows must carry DIFFERENT tags for the duplication to be
      // OBSERVABLE. With equal tags every duplicated row computes the same
      // value and the outer GROUP BY collapses them again, so a row-count
      // assertion is green whether the relation de-duplicates or not -- which
      // is exactly what a first version of this spec did, and it stayed green
      // with the DISTINCT ON removed. FRANCHISE is the discriminator because
      // that arm deliberately yields NULL, so a tag read from the wrong roster
      // row shows up as a blank cell.
      for (const [roster_id, tid, tag] of [
        [900002, 9001, player_tag_types.REGULAR],
        [900003, 9002, player_tag_types.FRANCHISE]
      ]) {
        await trx('rosters_players').insert({
          roster_id,
          slot: 1,
          pid: fanout_pid,
          player_position: 'MLB',
          tag,
          extensions: 0,
          tid,
          lid,
          week: 0,
          season_year: year
        })
      }
    })

    after(async () => {
      await trx.rollback()
    })

    // The LEFT-join gate. unrostered_pid matches neither relation, which on
    // production is ~96% of players; an inner join on either relation removes
    // them from the view entirely instead of rendering a blank cell. Downgrade
    // either leftJoin to a join and this goes red on the missing row.
    it('keeps a player who matches neither relation, with a blank value', async () => {
      const { query } = await get_data_view_results_query(over_market_request)
      const rows = await query.transacting(trx)
      const by_pid = Object.fromEntries(rows.map((row) => [row.pid, row]))

      expect(by_pid[unrostered_pid]).to.exist
      expect(
        by_pid[unrostered_pid].player_league_extended_salary_over_market_0
      ).to.equal(null)

      // The positive control: without it "everything is null" would satisfy the
      // assertion above and prove nothing. Salary ladder for an unextended
      // REGULAR tag is salary_paid + (extensions + 1) * 5 = 5 with no holding
      // row, less the 12.50 market salary.
      expect(by_pid[rostered_pid]).to.exist
      expect(
        Number(by_pid[rostered_pid].player_league_extended_salary_over_market_0)
      ).to.equal(-7.5)
    })

    // The de-duplication gate. DISTINCT ON ... ORDER BY pid, tid makes the
    // relation contribute exactly one tag, the lowest tid's -- REGULAR here, so
    // every row this player produces carries a number. Drop the DISTINCT ON and
    // the FRANCHISE row's tag reaches the join too, adding a blank row that no
    // roster state of this player can justify.
    //
    // Asserted on the VALUES rather than on a row count, and it must stay that
    // way. The extended-salary join carried a fan-out of its own on the same two
    // roster rows until it was de-duplicated in the same style; while that was
    // live the player yielded two rows in both worlds, so a count assertion
    // could not tell them apart. Now that the fan-out is closed a count would
    // appear to work -- but it would be asserting the OTHER join's
    // de-duplication, in a different join group, and would go green with this
    // relation's DISTINCT ON removed. Values are what discriminate here.
    it('contributes one tag for a player holding two week-0 rows in one league', async () => {
      const { query } = await get_data_view_results_query(over_market_request)
      const rows = await query.transacting(trx)
      const fanout_rows = rows.filter((row) => row.pid === fanout_pid)

      expect(fanout_rows).to.have.length.of.at.least(1)
      const blank = fanout_rows.filter(
        (row) => row.player_league_extended_salary_over_market_0 === null
      )
      expect(blank).to.have.lengthOf(
        0,
        'a NULL here means the FRANCHISE tag from the higher tid reached a row the relation should never have emitted'
      )
    })

    // The same gate for the OTHER join group. `player_extended_salary_join`
    // (player-extended-salary-column-definitions.mjs) joins its subquery to the
    // player row on pid alone and carried no de-duplication of its own, so the
    // same two roster rows multiplied every outer row they touched -- silently,
    // since it duplicates rather than raising the way the correlated roster-tag
    // form did.
    //
    // The two rows must yield DIFFERENT salaries for the duplication to be
    // observable at all, and here they do only because the extensions for this
    // scope are UNPROCESSED and the projected branch is live: tid 9001 takes the
    // REGULAR ladder, salary_paid + (extensions + 1) * 5 = 5 with no holding
    // row, while tid 9002 is FRANCHISE at position MLB, which no arm of the
    // franchise CASE names and which therefore falls to ELSE 0. Were the
    // extensions processed, both rows would collapse to COALESCE(salary_paid, 0)
    // = 0, the duplicates would carry equal values, and this assertion would be
    // a false green -- the same trap the roster-tag gate above fell into. The
    // ladder value 5 asserted below is what pins that branch.
    it('collapses a player holding two week-0 rows in one league to one salary row', async () => {
      const { query } = await get_data_view_results_query(over_market_request)
      const rows = await query.transacting(trx)
      const fanout_rows = rows.filter((row) => row.pid === fanout_pid)

      expect(fanout_rows).to.have.lengthOf(
        1,
        'two week-0 roster rows fanned the player out; the extended-salary subquery needs DISTINCT ON (pid)'
      )
      // ORDER BY pid, tid makes the survivor the LOWEST tid deterministically,
      // so it is 9001's REGULAR ladder and never 9002's FRANCHISE zero.
      expect(Number(fanout_rows[0].extended_salary_0)).to.equal(5)
    })

    // The other half of the two-scope pair. Separate relations make two values
    // POSSIBLE; only executing proves they are different. Collapse the two
    // market relations onto one and both columns render the same number --
    // valid SQL, correctly shaped, and wrong, which is the failure mode the
    // structural assertion above cannot see.
    it('resolves different market salaries for two columns at different formats', async () => {
      const { query } = await get_data_view_results_query({
        columns: [
          { column_id: 'player_league_extended_salary_over_market' },
          {
            column_id: 'player_league_extended_salary_over_market',
            params: { league_format_id: other_league_format_id }
          }
        ],
        prefix_columns: ['player_name'],
        where: [
          { column_id: 'player_position', operator: 'IN', value: ['MLB'] }
        ],
        sort: [],
        offset: 0,
        limit: 100
      })
      const rows = await query.transacting(trx)
      const row = rows.find((candidate) => candidate.pid === rostered_pid)

      expect(row).to.exist
      // Ladder salary 5, less each format's own seeded market salary.
      expect(Number(row.player_league_extended_salary_over_market_0)).to.equal(
        -7.5
      )
      expect(Number(row.player_league_extended_salary_over_market_1)).to.equal(
        2
      )
    })

    // The where-only path EXECUTED, not just emitted. A relation registered
    // after the filter string is built still has to land in the query for
    // Postgres to resolve the alias, and a text assertion cannot tell a
    // resolvable reference from a 42P01.
    it('filters on the pre-aggregated value with no column selected', async () => {
      const { query } = await get_data_view_results_query({
        columns: [],
        prefix_columns: ['player_name'],
        where: [
          { column_id: 'player_position', operator: 'IN', value: ['MLB'] },
          {
            column_id: 'player_league_extended_salary_over_market',
            operator: '>',
            value: -10
          }
        ],
        sort: [],
        offset: 0,
        limit: 100
      })
      const pids = (await query.transacting(trx)).map((row) => row.pid)

      expect(pids).to.include(rostered_pid)
      // NULL fails the predicate, which is what the correlated form did too.
      expect(pids).to.not.include(unrostered_pid)
    })
  })
})
