/* global describe before beforeEach it */

// Executed coverage for the draftkings_category_activity upsert.
//
// This exists because nothing else here could have caught the defect it pins.
// Every bare column reference inside an ON CONFLICT DO UPDATE SET expression is
// ambiguous -- the expression's namespace holds both the target table and
// `excluded` -- so Postgres raises 42702 and rejects the WHOLE statement,
// insert half included. The module shipped that way on 2025-10-01, the
// per-write catch swallowed the error, the importer reported success, and the
// table sat at exactly zero rows in production for ten months. The only trace
// was in the database log.
//
// The gate has to be an executed write. `yarn lint` does not type-check SQL,
// check-data-view-sql-validity only EXPLAINs data-view column SQL, and the
// suite's schema load cannot see a statement no spec ever runs.
//
// Every assertion below reads the row back rather than trusting the call to
// have thrown: track_category_activity is deliberately non-throwing, so a
// regression here is silent by construction and only the row can report it.

import * as chai from 'chai'

import db from '#db'
import {
  track_category_activity,
  get_tracking_write_stats,
  reset_tracking_write_stats
} from '#libs-server/draftkings/draftkings-tracking.mjs'

const expect = chai.expect

const read_row = () =>
  db('draftkings_category_activity')
    .where({ category_id: 492, subcategory_id: 4518 })
    .first()

describe('LIBS-SERVER /draftkings-tracking', function () {
  before(async function () {
    await db('draftkings_category_activity').del()
  })

  beforeEach(function () {
    reset_tracking_write_stats()
  })

  it('inserts a row on the first check', async () => {
    await track_category_activity({
      category_id: 492,
      subcategory_id: 4518,
      category_name: 'Game Lines',
      subcategory_name: 'Spread',
      offers_found: 5
    })

    // The insert half is what proves the 42702: it fires before any conflict
    // exists, so a broken DO UPDATE clause leaves the table empty rather than
    // stale, and the run still exits 0.
    expect(get_tracking_write_stats().write_failures).to.equal(0)

    const row = await read_row()
    expect(row).to.exist
    expect(row.total_checks).to.equal(1)
    expect(row.total_offers_found).to.equal(5)
    expect(row.last_seen_with_offers).to.not.equal(null)
  })

  it('accumulates the running totals on conflict', async () => {
    await track_category_activity({
      category_id: 492,
      subcategory_id: 4518,
      category_name: 'Game Lines',
      subcategory_name: 'Spread',
      offers_found: 3
    })

    expect(get_tracking_write_stats().write_failures).to.equal(0)

    const row = await read_row()
    expect(row.total_checks).to.equal(2)
    expect(row.total_offers_found).to.equal(8)
  })

  // The whole point of qualifying the CASE with the target table rather than
  // `excluded`: an offerless check must PRESERVE the last sighting. Reading
  // excluded.last_seen_with_offers would null it out here, which no exit code,
  // log line or row count would ever surface.
  it('preserves last_seen_with_offers when a check finds no offers', async () => {
    const before_row = await read_row()

    await track_category_activity({
      category_id: 492,
      subcategory_id: 4518,
      category_name: 'Game Lines',
      subcategory_name: 'Spread',
      offers_found: 0
    })

    expect(get_tracking_write_stats().write_failures).to.equal(0)

    const row = await read_row()
    expect(row.last_seen_with_offers).to.not.equal(null)
    expect(row.last_seen_with_offers.getTime()).to.equal(
      before_row.last_seen_with_offers.getTime()
    )
    expect(row.total_checks).to.equal(3)
    expect(row.total_offers_found).to.equal(8)
  })

  it('advances last_seen_with_offers when offers return', async () => {
    const before_row = await read_row()

    await track_category_activity({
      category_id: 492,
      subcategory_id: 4518,
      category_name: 'Game Lines',
      subcategory_name: 'Spread',
      offers_found: 7
    })

    const row = await read_row()
    expect(row.last_seen_with_offers.getTime()).to.be.at.least(
      before_row.last_seen_with_offers.getTime()
    )
    expect(row.total_offers_found).to.equal(15)
  })

  // A category never yet seen with offers must read NULL, because that is what
  // get_dead_categories's whereNull branch selects on. The insert half passes
  // an explicit null for this rather than relying on knex omitting undefined.
  it('leaves last_seen_with_offers null for a category that has never had offers', async () => {
    await track_category_activity({
      category_id: 999,
      subcategory_id: 1,
      category_name: 'Never Active',
      subcategory_name: null,
      offers_found: 0
    })

    const row = await db('draftkings_category_activity')
      .where({ category_id: 999, subcategory_id: 1 })
      .first()

    expect(get_tracking_write_stats().write_failures).to.equal(0)
    expect(row).to.exist
    expect(row.last_seen_with_offers).to.equal(null)
  })

  // The run-level oracle in import-draftkings-odds.mjs asserts on these, so a
  // counter that stops counting silently disarms the signal.
  it('counts every attempt, and counts a failure without throwing', async () => {
    // beforeEach resets, so the run starts from zero -- which is the property
    // import-draftkings-odds.mjs depends on to keep a long-lived worker from
    // inheriting the previous run's verdict.
    expect(get_tracking_write_stats().write_attempts).to.equal(0)

    await track_category_activity({
      category_id: 492,
      subcategory_id: 4518,
      category_name: 'Game Lines',
      subcategory_name: 'Spread',
      offers_found: 1
    })

    // category_id is NOT NULL, so this write is rejected by the database. The
    // call must still return normally -- one bad tracking write may not abort a
    // 21-minute odds sweep -- while leaving the failure visible in the stats.
    await track_category_activity({
      category_id: null,
      subcategory_id: 1,
      category_name: 'Broken',
      offers_found: 1
    })

    const stats = get_tracking_write_stats()
    expect(stats.write_attempts).to.equal(2)
    expect(stats.write_failures).to.equal(1)
    expect(stats.first_failure_message).to.be.a('string')
  })
})
