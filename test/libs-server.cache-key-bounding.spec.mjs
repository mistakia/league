/* global describe, it */

import * as chai from 'chai'

import { bound_cache_key_segment } from '#libs-server/cache.mjs'

const expect = chai.expect

// The real shape that broke: a Caesars competition secondary tab id that
// concatenates its whole market-group list. Percent-escaped in the URL, decoded
// by the route, and 692 bytes on disk at the longest measured on 2026-09-04.
const long_tab_segment = `${'_7cAlt_20Passing_20Yards_7c%7C'.repeat(30)}.json`

describe('libs-server cache key bounding', function () {
  // The property that makes applying this to a live cache safe. Without it,
  // every existing key would move and every warm cache entry would be orphaned.
  it('returns a segment already within the limit byte-identical', function () {
    for (const segment of [
      'caesars',
      'competition',
      'SCHEDULE%7CGames',
      'event-abc-123.json',
      'x'.repeat(255)
    ]) {
      expect(bound_cache_key_segment(segment)).to.equal(segment)
    }
  })

  // The boundary, from both sides, because a limit asserted only from the
  // failing side cannot show it sits where it is claimed to sit.
  it('squeezes at exactly the 255-byte boundary and not before', function () {
    expect(bound_cache_key_segment('x'.repeat(255))).to.equal('x'.repeat(255))
    expect(bound_cache_key_segment('x'.repeat(256))).to.not.equal(
      'x'.repeat(256)
    )
  })

  // Measured on the DECODED form, since Express decodes the route param before
  // the filename is built. A segment that is short once decoded must survive
  // untouched however long its escaped form is.
  it('measures the decoded length, not the URL length', function () {
    // 100 escapes, 300 characters in the URL, 100 bytes on disk.
    const escaped = '%7C'.repeat(100)
    expect(escaped.length).to.be.above(255)
    expect(bound_cache_key_segment(escaped)).to.equal(escaped)
  })

  it('brings an over-long segment within the limit', function () {
    const bounded = bound_cache_key_segment(long_tab_segment)
    expect(
      Buffer.byteLength(decodeURIComponent(long_tab_segment), 'utf8')
    ).to.be.above(255)
    expect(Buffer.byteLength(bounded, 'utf8')).to.be.at.most(255)
  })

  // The squeezed form must not itself need decoding, or the bound would hold on
  // the near side of the route and not the far side.
  it('produces a segment that decodes to itself', function () {
    const bounded = bound_cache_key_segment(long_tab_segment)
    expect(decodeURIComponent(bounded)).to.equal(bounded)
    expect(
      Buffer.byteLength(decodeURIComponent(bounded), 'utf8')
    ).to.be.at.most(255)
  })

  it('keeps the extension so a squeezed file is still recognisable', function () {
    expect(bound_cache_key_segment(long_tab_segment)).to.match(/\.json$/)
  })

  // The head is truncated, so uniqueness has to come from the digest. Two tabs
  // sharing a long prefix are exactly the case the Caesars tab ids present.
  it('does not collide on segments sharing a truncated prefix', function () {
    const shared = 'a'.repeat(400)
    const first = bound_cache_key_segment(`${shared}-passing.json`)
    const second = bound_cache_key_segment(`${shared}-rushing.json`)
    expect(first).to.not.equal(second)
  })

  it('is deterministic, so a write and a later read agree', function () {
    expect(bound_cache_key_segment(long_tab_segment)).to.equal(
      bound_cache_key_segment(long_tab_segment)
    )
  })
})
