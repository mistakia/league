/* global describe afterEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import run from '#scripts/import-fftoday-projections.mjs'

const expect = chai.expect

// fftoday answers a season/week it has not published with a 200 carrying this
// sentinel and no table at all. A markup change instead yields a real document
// whose rows the selector cannot find. The importer must tell those apart: the
// first is legitimate in the offseason, the second never is.
const sentinel_page =
  "<p>Please return to the <a href='https://www.fftoday.com'>FFToday.com home page</a>." +
  "<p style='color: red;'>No Player Found!</p>"

const changed_markup_page =
  '<html><body><table><tr><td>Rankings temporarily unavailable</td></tr></table></body></html>'

// 2026 week 1 is not yet published upstream; regular_season_start is the Tuesday
// nine days before the opener, so current_season.week is 0 until 2026-09-08.
const during_offseason = '2026-09-02T12:00:00Z'
const during_regular_season = '2026-10-15T12:00:00Z'

const serve = (body) => {
  global.fetch = async () => new Response(body, { status: 200 })
}

const attempt = async ({ body, now, season = false }) => {
  MockDate.set(now)
  serve(body)
  try {
    const result = await run({
      dry: true,
      is_regular_season_projection: season
    })
    return { threw: false, result }
  } catch (err) {
    return { threw: true, err }
  }
}

describe('SCRIPTS /import-fftoday-projections', function () {
  afterEach(() => {
    MockDate.reset()
    delete global.fetch
  })

  describe('upstream has not published the slice', function () {
    it('skips a weekly import in the offseason', async () => {
      const { threw, result } = await attempt({
        body: sentinel_page,
        now: during_offseason
      })
      expect(threw).to.equal(false)
      expect(result).to.deep.equal({ skipped: true })
    })

    it('throws once the offseason is over', async () => {
      const { threw, err } = await attempt({
        body: sentinel_page,
        now: during_regular_season
      })
      expect(threw).to.equal(true)
      expect(err.row_count_shortfall).to.equal(true)
      expect(err.message).to.match(/upstream reports no players/)
    })

    it('throws on the season-long path, which is never excused', async () => {
      const { threw, err } = await attempt({
        body: sentinel_page,
        now: during_offseason,
        season: true
      })
      expect(threw).to.equal(true)
      expect(err.row_count_shortfall).to.equal(true)
      expect(err.message).to.match(/upstream reports no players/)
    })
  })

  describe('the markup changed', function () {
    // The negative control for the skip above: without the sentinel the same
    // zero row count must stay a failure, offseason or not. A reworded sentinel
    // lands here too, which is the safe direction.
    it('throws in the offseason', async () => {
      const { threw, err } = await attempt({
        body: changed_markup_page,
        now: during_offseason
      })
      expect(threw).to.equal(true)
      expect(err.row_count_shortfall).to.equal(true)
      expect(err.message).to.match(/parsed 0 rows/)
    })

    it('throws during the regular season', async () => {
      const { threw, err } = await attempt({
        body: changed_markup_page,
        now: during_regular_season
      })
      expect(threw).to.equal(true)
      expect(err.row_count_shortfall).to.equal(true)
      expect(err.message).to.match(/parsed 0 rows/)
    })
  })
})
