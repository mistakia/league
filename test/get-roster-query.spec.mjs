/* global describe it */

import knex from 'knex'
import * as chai from 'chai'

import { build_roster_players_query } from '#libs-server/get-roster.mjs'

// Regression: the team id used to be applied as a WHERE filter on a LEFT JOIN,
// which silently degraded the join to an INNER JOIN. That reading is right for
// this query -- `transactions.player_salary` is the only source of a rostered
// player's salary, so a player with no team transaction has no cap value and
// must not be admitted with a null one -- but nothing in the SQL said so, and
// two separate sweeps had to re-derive it from the schema. Locking the shape
// here: the join is declared INNER, and the team id lives in the ON clause
// where a join qualifier belongs rather than in the WHERE where it reads as a
// row filter.

const { expect } = chai

// Regression: the transaction lookup was also unbounded in time, so it returned the
// newest transaction ever rather than the newest one in force at the roster's own
// (year, week). 23,655 of 44,293 rostered-player rows in production resolved to a
// transaction dated after the roster carrying them, backdating later salaries onto
// historical rosters. The as-of bound belongs in the ON clause for the same reason
// the team id does.

// The salary-in-force subselect carries its own WHERE, so the OUTER where is the
// last one in the statement. Slicing on the first would cut the ON clause short
// and read part of the subselect as the outer filter.
const outer_where_index = (statement) => statement.lastIndexOf(' where ')

const sql = build_roster_players_query({
  db: knex({ client: 'pg' }),
  roster_id: 9261,
  tid: 7,
  year: 2025,
  week: 4
}).toString()

describe('build_roster_players_query', () => {
  it('declares the transactions join as an inner join', () => {
    expect(sql).to.include('inner join "transactions"')
    expect(sql).to.not.include('left join "transactions"')
  })

  // The team id and the as-of bound now qualify the SHARED salary-in-force
  // subselect in roster-player-salary.mjs rather than this query's own ON
  // clause. Both guarantees are unchanged -- they moved so that the two other
  // readers of this rule could stop restating it and getting it wrong.
  it('constrains the team id inside the salary-in-force subselect', () => {
    const on_clause = sql.slice(
      sql.indexOf('inner join "transactions"'),
      outer_where_index(sql)
    )
    expect(on_clause).to.include('salary_transaction.tid = 7')
  })

  it('keeps the team id out of the WHERE clause', () => {
    const where_clause = sql.slice(outer_where_index(sql))
    expect(where_clause).to.not.include('"transactions"."tid"')
    expect(where_clause).to.not.include('salary_transaction.tid')
  })

  it('bounds the transaction lookup to the roster snapshot', () => {
    const on_clause = sql.slice(
      sql.indexOf('inner join "transactions"'),
      outer_where_index(sql)
    )
    expect(on_clause).to.include(
      '(salary_transaction.season_year, salary_transaction.week) <= (2025, 4)'
    )
  })

  // The rule this file exists to lock is `occurred_at`, not `transaction_id`.
  // Ids agree with chronology on ordinary data and stop agreeing after any
  // out-of-order insert, so a lookup ordered by id looks correct for years and
  // then silently returns a stale salary.
  it('never resolves the salary by transaction id alone', () => {
    expect(sql).to.not.include('max(transaction_id)')
  })

  it('keeps the as-of bound out of the WHERE clause', () => {
    const where_clause = sql.slice(outer_where_index(sql))
    expect(where_clause).to.not.include('transactions.season_year')
  })

  // The subselect now picks the winning transaction, so this ordering no longer
  // decides which row survives -- it keeps the output deterministic for the
  // `uniqBy` that follows, which matters only if a roster carries a duplicate
  // pid. Retained deliberately rather than dropped as dead.
  it('keeps a deterministic ordering for the uniqBy that follows', () => {
    expect(sql).to.include(
      'order by "transactions"."occurred_at" desc, "transactions"."transaction_id" desc'
    )
  })
})
