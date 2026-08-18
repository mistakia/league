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

  it('constrains the team id inside the ON clause', () => {
    const on_clause = sql.slice(
      sql.indexOf('inner join "transactions"'),
      sql.indexOf(' where ')
    )
    expect(on_clause).to.include('"transactions"."tid" = 7')
  })

  it('keeps the team id out of the WHERE clause', () => {
    const where_clause = sql.slice(sql.indexOf(' where '))
    expect(where_clause).to.not.include('"transactions"."tid"')
  })

  it('bounds the transaction lookup to the roster snapshot inside the ON clause', () => {
    const on_clause = sql.slice(
      sql.indexOf('inner join "transactions"'),
      sql.indexOf(' where ')
    )
    expect(on_clause).to.include(
      '(transactions.season_year, transactions.week) <= (2025, 4)'
    )
  })

  it('keeps the as-of bound out of the WHERE clause', () => {
    const where_clause = sql.slice(sql.indexOf(' where '))
    expect(where_clause).to.not.include('transactions.season_year')
  })

  it('orders so the newest transaction per player wins the uniqBy', () => {
    expect(sql).to.include(
      'order by "transactions"."occurred_at" desc, "transactions"."transaction_id" desc'
    )
  })
})
