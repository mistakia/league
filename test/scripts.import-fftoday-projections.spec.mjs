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

// fftoday rate-limits with a 403 after roughly a dozen rapid requests, and the
// body it serves with that status parses to zero rows exactly like a redesign.
// The status is the only thing separating them, so the stub carries it.
const serve = (body, status = 200) => {
  global.fetch = async () => new Response(body, { status })
}

const attempt = async ({ body, now, season = false, status = 200 }) => {
  MockDate.set(now)
  serve(body, status)
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

  // fftoday gives no notice of when it opens a board, so there is no season
  // phase in which an unpublished slice is unexpected. Every one of these is a
  // graceful skip rather than a failure.
  describe('upstream has not published the slice', function () {
    it('skips a weekly import in the offseason', async () => {
      const { threw, result } = await attempt({
        body: sentinel_page,
        now: during_offseason
      })
      expect(threw).to.equal(false)
      expect(result).to.deep.equal({ skipped: true, unpublished: true })
    })

    it('skips a weekly import during the regular season too', async () => {
      const { threw, result } = await attempt({
        body: sentinel_page,
        now: during_regular_season
      })
      expect(threw).to.equal(false)
      expect(result).to.deep.equal({ skipped: true, unpublished: true })
    })

    it('skips the season-long path on the same rule', async () => {
      const { threw, result } = await attempt({
        body: sentinel_page,
        now: during_offseason,
        season: true
      })
      expect(threw).to.equal(false)
      expect(result).to.deep.equal({ skipped: true, unpublished: true })
    })
  })

  // The third case the zero-row parse used to swallow. fftoday rate-limits with
  // a 403, whose body carries neither the sentinel nor a table, so before the
  // helper looked at the status this arrived at throw_if_shortfall wearing the
  // "parsed 0 rows" message -- reporting a redesign when the truth was that we
  // were refused. It must fail, but it must NOT claim the markup moved.
  describe('upstream refused the request', function () {
    it('reports the status rather than a markup change on a 403', async () => {
      const { threw, err } = await attempt({
        body: changed_markup_page,
        now: during_regular_season,
        status: 403
      })
      expect(threw).to.equal(true)
      expect(err.http_status).to.equal(403)
      expect(err.message).to.match(/403/)
      expect(err.message).to.not.match(/parsed 0 rows/)
      expect(err.row_count_shortfall).to.not.equal(true)
    })

    // A 5xx is the same class and must read the same way.
    it('reports the status rather than a markup change on a 503', async () => {
      const { threw, err } = await attempt({
        body: changed_markup_page,
        now: during_regular_season,
        status: 503
      })
      expect(threw).to.equal(true)
      expect(err.http_status).to.equal(503)
      expect(err.row_count_shortfall).to.not.equal(true)
    })

    // The case `response.ok` cannot catch, and the reason this check is
    // `status !== 200` rather than `!response.ok`: a WAF challenge answers 202,
    // which is inside the 2xx range, with an empty body dressed as success.
    // Even served with the sentinel it must fail rather than skip -- a
    // challenge is not fftoday telling us the board is unpublished.
    it('fails a 202 challenge even when the body carries the sentinel', async () => {
      const { threw, err } = await attempt({
        body: sentinel_page,
        now: during_regular_season,
        status: 202
      })
      expect(threw).to.equal(true)
      expect(err.http_status).to.equal(202)
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
