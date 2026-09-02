/* global describe afterEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import run from '#scripts/import-cbs-projections.mjs'

const expect = chai.expect

// CBS answers every slice with a full board -- there is no empty-table state to
// serve as an "unpublished" signal. What DOES move is the page heading, which
// names the season actually served. Measured 2026-09-02: asking for 2027 or
// 2030 returns the identical 2026 board under a "2026 Projections" heading.
const board = (heading_year, { rows = 2 } = {}) => `
<html><body>
  <h1>${heading_year} Projections Fantasy Football Quarterback Stats</h1>
  <div class="TableBase"><table><tbody>
    ${Array.from({ length: rows })
      .map(
        (_, i) => `
      <tr>
        <td><span class="CellPlayerName--long">
          <a>Player ${i}</a>
          <span class="CellPlayerName-team">BUF</span>
          <span class="CellPlayerName-position">QB</span>
        </span></td>
        <td>1</td><td>500</td><td>340</td><td>3700</td><td>220</td>
        <td>30</td><td>10</td><td>0</td><td>40</td><td>300</td>
        <td>0</td><td>4</td><td>2</td>
      </tr>`
      )
      .join('')}
  </tbody></table></div>
</body></html>`

// The board CBS serves once it has opened the requested season.
const current_board = board(2026)

// Same season, but the table selector finds nothing -- the redesign case. The
// heading still parses, so nothing else can excuse the zero row count.
const changed_markup_page = `
<html><body>
  <h1>2026 Projections Fantasy Football Quarterback Stats</h1>
  <table><tr><td>Projections temporarily unavailable</td></tr></table>
</body></html>`

// A redesign that also takes the heading with it. This must fail rather than be
// read as an unopened season -- the safe direction.
const heading_removed_page = `
<html><body>
  <div class="TableBase"><table><tbody></tbody></table></div>
</body></html>`

const during_offseason = '2026-06-15T12:00:00Z'

const attempt = async ({ body, now = during_offseason, season = true }) => {
  MockDate.set(now)
  global.fetch = async () => new Response(body, { status: 200 })
  try {
    return { threw: false, result: await run({ dry: true, season }) }
  } catch (err) {
    return { threw: true, err }
  }
}

describe('SCRIPTS /import-cbs-projections', function () {
  afterEach(() => {
    MockDate.reset()
    delete global.fetch
  })

  describe('upstream has not opened the season', function () {
    // CBS gives no notice of when it rolls the board over, so there is no date
    // or season phase in which serving last year is unexpected. Graceful skip.
    it('skips when CBS is still serving the previous season board', async () => {
      const { threw, result } = await attempt({ body: board(2025) })
      expect(threw).to.equal(false)
      expect(result).to.deep.equal({ skipped: true, unpublished: true })
    })

    it('imports normally once the board turns over', async () => {
      const { threw, result } = await attempt({ body: current_board })
      expect(threw).to.equal(false)
      expect(result).to.equal(undefined) // dry run returns early
    })
  })

  describe('the markup changed', function () {
    // The negative controls for the skip above. A zero row count with a
    // heading that parses and matches has no innocent explanation left, and a
    // heading that stopped parsing is itself the markup change.
    it('throws on a zero-row parse under a matching heading', async () => {
      const { threw, err } = await attempt({ body: changed_markup_page })
      expect(threw).to.equal(true)
      expect(err.row_count_shortfall).to.equal(true)
      expect(err.message).to.match(/parsed 0 rows/)
    })

    it('throws when the heading is gone rather than reading it as unopened', async () => {
      const { threw, err } = await attempt({ body: heading_removed_page })
      expect(threw).to.equal(true)
      expect(err.row_count_shortfall).to.equal(true)
      expect(err.message).to.match(/could not read the board season/)
    })

    // Asking for a year CBS has already moved past is this importer being
    // wrong, not the vendor withholding a slice.
    it('throws when CBS serves a season ahead of the requested one', async () => {
      const { threw, err } = await attempt({ body: board(2027) })
      expect(threw).to.equal(true)
      expect(err.row_count_shortfall).to.equal(true)
      expect(err.message).to.match(/served the 2027 board/)
    })
  })

  describe('the weekly path', function () {
    // CBS ignores the week segment entirely and returns season-long totals, so
    // this path used to write full-season numbers into week-N rows.
    it('refuses rather than writing season totals as weekly projections', async () => {
      const { threw, err } = await attempt({
        body: current_board,
        season: false
      })
      expect(threw).to.equal(true)
      expect(err.message).to.match(/publishes no weekly board/)
    })
  })
})
