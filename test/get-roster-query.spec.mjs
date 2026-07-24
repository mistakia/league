/* global describe it */

import knex from 'knex'
import * as chai from 'chai'

import { build_roster_players_query } from '#libs-server/get-roster.mjs'

// Regression: the team id used to be applied as a WHERE filter on a LEFT JOIN,
// which silently degraded the join to an INNER JOIN. That reading is right for
// this query -- `transactions.value` is the only source of a rostered player's
// salary, so a player with no team transaction has no cap value and must not be
// admitted with a null one -- but nothing in the SQL said so, and two separate
// sweeps had to re-derive it from the schema. Locking the shape here: the join
// is declared INNER, and the team id lives in the ON clause where a join
// qualifier belongs rather than in the WHERE where it reads as a row filter.

const { expect } = chai

const sql = build_roster_players_query({
  db: knex({ client: 'pg' }),
  rid: 9261,
  tid: 7
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

  it('orders so the newest transaction per player wins the uniqBy', () => {
    expect(sql).to.include(
      'order by "transactions"."timestamp" desc, "transactions"."uid" desc'
    )
  })
})
