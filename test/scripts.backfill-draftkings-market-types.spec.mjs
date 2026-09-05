/* global describe it */

import * as chai from 'chai'

import { plan_market_type_backfill } from '#scripts/backfill-draftkings-market-types.mjs'

chai.should()

// 1000/9524 maps to GAME_PASSING_YARDS; 1303 is a declined category the mapper
// returns null for.
const RESOLVABLE = {
  offer_category_id: 1000,
  subcategory_id: 9524,
  bet_offer_type_id: 0,
  market_type_id: null
}
const DECLINED = {
  offer_category_id: 1303,
  subcategory_id: 13571,
  bet_offer_type_id: 0,
  market_type_id: null
}

describe('backfill-draftkings-market-types planning', function () {
  it('plans a write for a tuple the current mapper resolves', function () {
    const plan = plan_market_type_backfill({
      tuples: [{ ...RESOLVABLE, row_count: 500 }]
    })

    plan.recoverable_row_count.should.equal(500)
    plan.unresolved_row_count.should.equal(0)
    plan.resolvable.should.have.lengthOf(1)
    plan.resolvable[0].market_type.should.equal('GAME_PASSING_YARDS')
  })

  // The control: a planner that resolved everything would pass the case above
  // and fail this one.
  it('leaves a declined tuple out of the write set entirely', function () {
    const plan = plan_market_type_backfill({
      tuples: [{ ...DECLINED, row_count: 500 }]
    })

    plan.recoverable_row_count.should.equal(0)
    plan.unresolved_row_count.should.equal(500)
    plan.resolvable.should.have.lengthOf(0)
    plan.by_market_type.should.have.lengthOf(0)
  })

  it('partitions every row into recoverable or unresolved', function () {
    const plan = plan_market_type_backfill({
      tuples: [
        { ...RESOLVABLE, row_count: 300 },
        { ...DECLINED, row_count: 700 }
      ]
    })
    ;(plan.recoverable_row_count + plan.unresolved_row_count).should.equal(1000)
  })

  it('aggregates the row counts per target market type', function () {
    const plan = plan_market_type_backfill({
      tuples: [
        { ...RESOLVABLE, row_count: 300 },
        { ...RESOLVABLE, bet_offer_type_id: 1, row_count: 200 }
      ]
    })

    plan.by_market_type.should.have.lengthOf(1)
    plan.by_market_type[0].market_type.should.equal('GAME_PASSING_YARDS')
    plan.by_market_type[0].row_count.should.equal(500)
  })
})
