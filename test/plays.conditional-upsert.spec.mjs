/* global describe it before beforeEach after */

// The finalization watermark guard keys on nfl_plays.updated, so the whole
// mechanism rests on one claim about real Postgres behavior: a second import
// pass carrying identical values must not advance `updated`, and a pass
// carrying a changed value must. The generated-SQL cases in
// plays-field-reads.spec.mjs pin the predicate's SHAPE; these run it against a
// real database, because a predicate that is well-formed and still writes every
// row would pass those and defeat the guard in production.
//
// This exercises upsert_plays -- the function the importer actually calls --
// rather than a restatement of the chain, so a call site that stopped passing
// the predicate would surface here.

import * as chai from 'chai'

import db from '#db'
import { upsert_plays } from '#libs-server/upsert-plays.mjs'

const expect = chai.expect

const esbid = 9900001
const conflict_columns = ['esbid', 'play_id', 'season_year']

const play_row = ({ play_id, updated, ...rest }) => ({
  esbid,
  play_id,
  season_year: 2025,
  week: 1,
  season_type: 'REG',
  quarter: 1,
  updated,
  ...rest
})

const upsert = (rows) =>
  upsert_plays({ table: 'nfl_plays', rows, conflict_columns })

const max_updated = async () => {
  const row = await db('nfl_plays')
    .where({ esbid })
    .max('updated as max')
    .first()
  return row.max
}

describe('nfl_plays conditional upsert against a real database', function () {
  before(async () => {
    await db('nfl_plays').where({ esbid }).del()
  })

  // The suite shares one database across every spec file, so seeded plays left
  // behind are read by anything that aggregates nfl_plays.
  after(async () => {
    await db('nfl_plays').where({ esbid }).del()
  })

  beforeEach(async () => {
    await db('nfl_plays').where({ esbid }).del()
    await upsert([
      play_row({ play_id: 1, updated: new Date('2026-01-01T00:00:00Z') }),
      play_row({ play_id: 2, updated: new Date('2026-01-01T00:00:00Z') })
    ])
  })

  it('leaves updated alone when a second pass changes nothing', async () => {
    const before_updated = await max_updated()

    // The importer stamps a fresh timestamp on every row of every pass, so this
    // is exactly the shape of a re-import of an unchanged completed game.
    const written = await upsert([
      play_row({ play_id: 1, updated: new Date('2026-06-01T00:00:00Z') }),
      play_row({ play_id: 2, updated: new Date('2026-06-01T00:00:00Z') })
    ])

    expect(written.length).to.equal(0)
    expect((await max_updated()).getTime()).to.equal(before_updated.getTime())
  })

  it('advances updated when a play value genuinely changes', async () => {
    // The negative control for the whole mechanism: a guard that suppressed
    // this too would look identical to one that works, and a corrected play
    // would never re-finalize.
    const written = await upsert([
      play_row({ play_id: 1, updated: new Date('2026-06-01T00:00:00Z') }),
      play_row({
        play_id: 2,
        updated: new Date('2026-06-01T00:00:00Z'),
        quarter: 4
      })
    ])

    expect(written.length).to.equal(1)
    expect((await max_updated()).toISOString()).to.equal(
      '2026-06-01T00:00:00.000Z'
    )
  })

  it('treats a null-to-value transition as a change', async () => {
    const written = await upsert([
      play_row({
        play_id: 1,
        updated: new Date('2026-06-01T00:00:00Z'),
        down_number: 3
      })
    ])

    expect(written.length).to.equal(1)
  })

  it('treats a null-to-null column as unchanged', async () => {
    // Row-wise IS DISTINCT FROM is what makes this hold; a plain <> would
    // evaluate to null here and suppress every subsequent real write.
    const written = await upsert([
      play_row({
        play_id: 1,
        updated: new Date('2026-06-01T00:00:00Z'),
        down_number: null
      })
    ])

    expect(written.length).to.equal(0)
  })

  it('does not read an untagged drive_sequence as a change on every pass', async () => {
    await upsert([
      play_row({
        play_id: 1,
        updated: new Date('2026-02-01T00:00:00Z'),
        drive_sequence: 4
      })
    ])

    // The live worker re-polls with drive_sequence null for any play the feed
    // has not tagged. The merge coalesces that to the stored 4, so nothing
    // changes -- and the predicate must agree, or every poll of every untagged
    // play rewrites the row and the watermark never settles.
    const written = await upsert([
      play_row({
        play_id: 1,
        updated: new Date('2026-06-01T00:00:00Z'),
        drive_sequence: null
      })
    ])

    expect(written.length).to.equal(0)
    expect(
      (await db('nfl_plays').where({ esbid, play_id: 1 }).first())
        .drive_sequence
    ).to.equal(4)
  })

  it('writes a play the table has never seen', async () => {
    const written = await upsert([
      play_row({ play_id: 3, updated: new Date('2026-06-01T00:00:00Z') })
    ])

    expect(written.length).to.equal(1)
  })

  it('leaves a column alone for rows that do not mention it', async () => {
    await upsert([
      play_row({
        play_id: 1,
        updated: new Date('2026-02-01T00:00:00Z'),
        down_number: 3
      }),
      play_row({
        play_id: 2,
        updated: new Date('2026-02-01T00:00:00Z'),
        down_number: 3
      })
    ])

    // Only play 1 asserts down_number on this pass. knex takes the UNION of
    // both rows' keys for its single statement and fills DEFAULT for play 2,
    // so without grouping the merge writes NULL over play 2's stored 3 -- and
    // the predicate reports that clobber as a change, advancing `updated` for a
    // row whose payload never mentioned the column. This is the same
    // null-outranks-stored failure the drive_sequence coalesce covers for one
    // column, arriving through the batch shape instead.
    const written = await upsert([
      play_row({
        play_id: 1,
        updated: new Date('2026-06-01T00:00:00Z'),
        down_number: 4
      }),
      play_row({ play_id: 2, updated: new Date('2026-06-01T00:00:00Z') })
    ])

    expect(written.length).to.equal(1)

    const rows = await db('nfl_plays').where({ esbid }).orderBy('play_id')
    expect(rows[0].down_number).to.equal(4)
    expect(rows[1].down_number).to.equal(3)
  })
})
