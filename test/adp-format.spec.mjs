/* global describe it before after */

import * as chai from 'chai'
import fs from 'fs/promises'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'

import db from '#db'
import { adp_format } from '#libs-shared'
import { find_or_create_adp_format } from '#libs-server'

const __dirname = dirname(fileURLToPath(import.meta.url))

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

describe('LIBS-SERVER find_or_create_adp_format', function () {
  // The non-destructive dimension DDL is not yet in the canonical schema dump
  // (it lands there only via the gated export:schema from prod), so load it
  // here when the table is absent. Guarded so the test still works after the
  // export step lands adp_format in db/schema.postgres.sql.
  //
  // These tests commit adp_format rows to the shared test DB (find_or_create is
  // not transactional). Capture the rows present before the suite runs so the
  // after hook can drop only what this suite minted -- otherwise the leaked
  // (PPR, 1QB, REDRAFT, ALL, MANAGED) row collides on adp_format_axis_unique with
  // the data-view result-equivalence fixture's same-axis seed later in the run.
  let preexisting_adp_format_ids = []

  before(async function () {
    // The adp_format unique index uses NULLS NOT DISTINCT (PG 15+). Prod is
    // 16.14; a pre-15 local DB cannot parse the DDL, and a COALESCE-shimmed
    // index would not faithfully exercise the helper's plain-column ON CONFLICT.
    // Skip there -- decode-map injectivity is already covered by the pure tests
    // above; this block runs on any PG 15+ DB (CI / prod-version).
    const version = await db.raw('show server_version_num')
    if (parseInt(version.rows[0].server_version_num, 10) < 150000) {
      this.skip()
    }
    const has_table = await db.schema.hasTable('adp_format')
    if (!has_table) {
      const ddl = await fs.readFile(
        path.resolve(
          __dirname,
          '../db/adhoc/2026-06-10-adp-format-dimension.sql'
        ),
        'utf8'
      )
      await db.raw(ddl)
    }

    const existing = await db('adp_format').select('id')
    preexisting_adp_format_ids = existing.map((row) => row.id)
  })

  after(async function () {
    // Drop only the adp_format rows this suite committed, leaving the shared DB
    // as we found it for subsequent test files.
    if (await db.schema.hasTable('adp_format')) {
      await db('adp_format').whereNotIn('id', preexisting_adp_format_ids).del()
    }
  })

  const base_axes = {
    scoring_class: 'PPR',
    scoring_format_id: null,
    num_qb: 1,
    num_teams: null,
    duration: 'REDRAFT',
    draft_pool: 'ALL',
    contest_style: 'MANAGED'
  }

  it('returns the same id for identical axes (idempotent)', async () => {
    const a = await find_or_create_adp_format(db, base_axes)
    const b = await find_or_create_adp_format(db, { ...base_axes })
    a.should.be.a('string')
    a.should.equal(b)
  })

  it('returns a new id when an axis differs', async () => {
    const a = await find_or_create_adp_format(db, base_axes)
    const superflex = await find_or_create_adp_format(db, {
      ...base_axes,
      num_qb: 2
    })
    superflex.should.not.equal(a)
    const bestball = await find_or_create_adp_format(db, {
      ...base_axes,
      contest_style: 'BEST_BALL'
    })
    bestball.should.not.equal(a)
    bestball.should.not.equal(superflex)
  })

  it('treats null tuple columns as equal (NULLS NOT DISTINCT)', async () => {
    // both calls leave scoring_format_id and num_teams null; the index must
    // collapse them to one row rather than minting a fresh id each time.
    const a = await find_or_create_adp_format(db, {
      scoring_class: 'HALF_PPR',
      num_qb: 1,
      duration: 'REDRAFT',
      draft_pool: 'ALL',
      contest_style: 'BEST_BALL'
    })
    const b = await find_or_create_adp_format(db, {
      scoring_class: 'HALF_PPR',
      num_qb: 1,
      duration: 'REDRAFT',
      draft_pool: 'ALL',
      contest_style: 'BEST_BALL'
    })
    a.should.equal(b)
  })

  it('resolves every decoded legacy adp_type to a distinct id', async () => {
    const ids = new Set()
    for (const adp_type of LEGACY_ADP_TYPES) {
      const id = await find_or_create_adp_format(db, decode_adp_type(adp_type))
      ids.add(id)
    }
    // injective decode map -> one distinct adp_format row per legacy literal
    ids.size.should.equal(LEGACY_ADP_TYPES.length)
  })
})
