/* global describe it */

import * as chai from 'chai'

import { adp_format } from '#libs-shared'

const {
  SCORING_CLASS,
  DURATION,
  DRAFT_POOL,
  CONTEST_STYLE,
  ADP_FORMAT_TUPLE_COLUMNS,
  LEGACY_ADP_TYPES,
  ADP_TYPE_DECODE_MAP,
  decode_adp_type
} = adp_format

chai.should()
const expect = chai.expect

const tuple_key = (t) =>
  ADP_FORMAT_TUPLE_COLUMNS.map((col) => `${col}=${t[col]}`).join('|')

describe('LIBS-SHARED adp-format decode map', function () {
  it('covers every legacy adp_type literal exactly (closed coverage)', () => {
    const map_keys = Object.keys(ADP_TYPE_DECODE_MAP).sort()
    const legacy = [...LEGACY_ADP_TYPES].sort()
    map_keys.should.deep.equal(legacy)
    // sanity: the 19 enum literals from db/schema.postgres.sql
    LEGACY_ADP_TYPES.length.should.equal(19)
  })

  it('decodes every literal to a tuple satisfying the CHECK constraints', () => {
    for (const adp_type of LEGACY_ADP_TYPES) {
      const t = decode_adp_type(adp_type)
      SCORING_CLASS.should.include(t.scoring_class, adp_type)
      DURATION.should.include(t.duration, adp_type)
      DRAFT_POOL.should.include(t.draft_pool, adp_type)
      CONTEST_STYLE.should.include(t.contest_style, adp_type)
      Number.isInteger(t.num_qb).should.equal(true, adp_type)
      t.num_qb.should.be.at.least(1, adp_type)
      // legacy rows carry no concrete scoring link or team count
      expect(t.scoring_format_id, adp_type).to.equal(null)
      expect(t.num_teams, adp_type).to.equal(null)
    }
  })

  it('is injective -- no two literals decode to the same tuple', () => {
    const seen = new Map()
    for (const adp_type of LEGACY_ADP_TYPES) {
      const key = tuple_key(decode_adp_type(adp_type))
      if (seen.has(key)) {
        throw new Error(
          `decode collision: ${adp_type} and ${seen.get(key)} both map to ${key}`
        )
      }
      seen.set(key, adp_type)
    }
    seen.size.should.equal(LEGACY_ADP_TYPES.length)
  })

  it('maps the empty BESTBALL bucket to half-PPR 1QB redraft best ball', () => {
    const t = decode_adp_type('BESTBALL')
    t.scoring_class.should.equal('HALF_PPR')
    t.num_qb.should.equal(1)
    t.duration.should.equal('REDRAFT')
    t.draft_pool.should.equal('ALL')
    t.contest_style.should.equal('BEST_BALL')
  })

  it('distinguishes superflex (num_qb 2) from 1QB', () => {
    decode_adp_type('PPR_REDRAFT').num_qb.should.equal(1)
    decode_adp_type('PPR_SUPERFLEX_REDRAFT').num_qb.should.equal(2)
  })

  it('maps rookie drafts to dynasty duration with rookie draft pool', () => {
    const t = decode_adp_type('PPR_ROOKIE')
    t.duration.should.equal('DYNASTY')
    t.draft_pool.should.equal('ROOKIE')
    // distinct from the plain dynasty type
    decode_adp_type('PPR_DYNASTY').draft_pool.should.equal('ALL')
  })

  it('throws loudly on an unknown adp_type', () => {
    expect(() => decode_adp_type('NOT_A_REAL_TYPE')).to.throw(
      /no adp_format decode mapping/
    )
  })

  it('returns a fresh object (callers cannot mutate the shared map)', () => {
    const a = decode_adp_type('PPR_REDRAFT')
    a.num_qb = 999
    decode_adp_type('PPR_REDRAFT').num_qb.should.equal(1)
  })
})
