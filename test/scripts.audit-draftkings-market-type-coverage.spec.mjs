/* global describe it */

import * as chai from 'chai'

import {
  classify_market_type_coverage,
  STALE_REFUSAL_SHARE_THRESHOLD,
  STALE_REFUSAL_MARKET_FLOOR
} from '#scripts/audit-draftkings-market-type-coverage.mjs'

chai.should()
const expect = chai.expect

// Real ids, so the fixtures exercise the same mapper arms production does.
// 1000/9524 maps to GAME_PASSING_YARDS; 1303 is a declined CATEGORY; 15047 is a
// declined SUBCATEGORY under category 527, which the mapper models.
const MAPPED = {
  offer_category_id: 1000,
  subcategory_id: 9524,
  bet_offer_type_id: 0,
  market_type_id: null
}
const DECLINED_CATEGORY = {
  offer_category_id: 1303,
  subcategory_id: 13571,
  bet_offer_type_id: 0,
  market_type_id: null
}
const DECLINED_SUBCATEGORY = {
  offer_category_id: 527,
  subcategory_id: 15047,
  bet_offer_type_id: 0,
  market_type_id: null
}
// An id in neither set: the arm the per-run oracle owns.
const NOVEL = {
  offer_category_id: 527,
  subcategory_id: 999999,
  bet_offer_type_id: 0,
  market_type_id: null
}

const declined_subcategory_ids = new Set([DECLINED_SUBCATEGORY.subcategory_id])
const declined_category_ids = new Set([DECLINED_CATEGORY.offer_category_id])

const classify = (tuples, overrides = {}) =>
  classify_market_type_coverage({
    tuples,
    declined_subcategory_ids,
    declined_category_ids,
    ...overrides
  })

describe('audit-draftkings-market-type-coverage classification', function () {
  it('maps a tuple the mapper recognises and reports no shortfall', function () {
    const result = classify([{ ...MAPPED, market_count: 1000 }])

    result.mapped_market_count.should.equal(1000)
    result.unmapped_market_count.should.equal(0)
    result.unclassified_share.should.equal(0)
    result.stale_category_refusals.should.have.lengthOf(0)
    result.stale_subcategory_refusals.should.have.lengthOf(0)
  })

  // The control the two firing cases below are varied from. Without it, a
  // classifier that reported a stale refusal on every input would pass them
  // both.
  it('stays quiet on a declined family below the share threshold', function () {
    const result = classify([
      { ...MAPPED, market_count: 100000 },
      { ...DECLINED_CATEGORY, market_count: 2000 }
    ])

    result.declined_category_volumes.should.have.lengthOf(1)
    result.declined_category_volumes[0].market_count.should.equal(2000)
    result.stale_category_refusals.should.have.lengthOf(0)
  })

  it('reports a declined CATEGORY that clears both the share and the floor', function () {
    const result = classify([
      { ...MAPPED, market_count: 10000 },
      { ...DECLINED_CATEGORY, market_count: 5000 }
    ])

    result.stale_category_refusals.should.have.lengthOf(1)
    const [entry] = result.stale_category_refusals
    entry.offer_category_id.should.equal(DECLINED_CATEGORY.offer_category_id)
    entry.market_count.should.equal(5000)
    entry.market_share.should.be.above(STALE_REFUSAL_SHARE_THRESHOLD)
    entry.subcategory_ids.should.eql([DECLINED_CATEGORY.subcategory_id])
  })

  it('reports a declined SUBCATEGORY under a category we model', function () {
    const result = classify([
      { ...MAPPED, market_count: 10000 },
      { ...DECLINED_SUBCATEGORY, market_count: 5000 }
    ])

    result.stale_subcategory_refusals.should.have.lengthOf(1)
    result.stale_subcategory_refusals[0].subcategory_id.should.equal(
      DECLINED_SUBCATEGORY.subcategory_id
    )
    result.stale_category_refusals.should.have.lengthOf(0)
  })

  // The offseason artifact the floor exists for. Both assertions matter: the
  // share alone WOULD fire here, so a floor that stopped working would be
  // invisible without the first one.
  it('suppresses a family that clears the share on a collapsed denominator', function () {
    const tuples = [
      { ...MAPPED, market_count: 1000 },
      { ...DECLINED_CATEGORY, market_count: 200 }
    ]

    const result = classify(tuples)
    result.declined_category_volumes[0].market_share.should.be.above(
      STALE_REFUSAL_SHARE_THRESHOLD
    )
    result.declined_category_volumes[0].market_count.should.be.below(
      STALE_REFUSAL_MARKET_FLOOR
    )
    result.stale_category_refusals.should.have.lengthOf(0)

    // Same family, same share, in-season volume: now it fires. The pair is what
    // proves the floor is the discriminator rather than something else.
    const in_season = classify([
      { ...MAPPED, market_count: 100000 },
      { ...DECLINED_CATEGORY, market_count: 20000 }
    ])
    in_season.stale_category_refusals.should.have.lengthOf(1)
  })

  // Category-grain decline outranks subcategory-grain, so a subcategory under a
  // declined family is never named on its own.
  it('attributes a tuple under a declined category to the category arm only', function () {
    const result = classify([
      { ...MAPPED, market_count: 10000 },
      {
        ...DECLINED_CATEGORY,
        subcategory_id: DECLINED_SUBCATEGORY.subcategory_id,
        market_count: 5000
      }
    ])

    result.stale_category_refusals.should.have.lengthOf(1)
    result.stale_subcategory_refusals.should.have.lengthOf(0)
  })

  it('routes an id in neither set to the novel arm and never pages on it', function () {
    const result = classify([
      { ...MAPPED, market_count: 10000 },
      { ...NOVEL, market_count: 50000 }
    ])

    result.novel_tuples.should.have.lengthOf(1)
    result.novel_tuples[0].subcategory_id.should.equal(NOVEL.subcategory_id)
    result.stale_category_refusals.should.have.lengthOf(0)
    result.stale_subcategory_refusals.should.have.lengthOf(0)
  })

  // Containment: every unmapped market lands in exactly one of the three arms.
  // This is what caught the arithmetic on the first production run.
  it('partitions every market into mapped, declined or novel', function () {
    const result = classify([
      { ...MAPPED, market_count: 700 },
      { ...DECLINED_CATEGORY, market_count: 200 },
      { ...DECLINED_SUBCATEGORY, market_count: 60 },
      { ...NOVEL, market_count: 40 }
    ])

    const declined_total = [
      ...result.declined_category_volumes,
      ...result.declined_subcategory_volumes
    ].reduce((sum, entry) => sum + entry.market_count, 0)
    const novel_total = result.novel_tuples.reduce(
      (sum, entry) => sum + entry.market_count,
      0
    )

    result.total_market_count.should.equal(1000)
    result.mapped_market_count.should.equal(700)
    result.unmapped_market_count.should.equal(300)
    ;(declined_total + novel_total).should.equal(result.unmapped_market_count)
  })

  it('returns a null unclassified share rather than dividing by zero', function () {
    const result = classify([])
    expect(result.unclassified_share).to.equal(null)
    result.total_market_count.should.equal(0)
  })
})
