/* global describe beforeEach it */

import * as chai from 'chai'

import db from '#db'
import { erased_role_attribution_by_play_type } from '#libs-server/erased-role-attribution.mjs'

chai.should()
const expect = chai.expect

const esbid = 979901
const play_id = 1

const insert_play = async ({
  play_type,
  passer_pid = null,
  passer_gsis_player_id = null
}) =>
  db('nfl_plays').insert({
    esbid,
    play_id,
    season_year: 2025,
    season_type: 'REG',
    week: 1,
    updated: db.raw('to_timestamp(0)'),
    play_type,
    passer_pid,
    passer_gsis_player_id
  })

// The changelog row is what makes a play "once attributed". Passer uses the
// PRE-conform spelling and only that one.
const insert_clear = async () =>
  db('play_changelog').insert({
    esbid,
    play_id,
    column_name: 'psr_gsis',
    previous_value: '00-0012345',
    new_value: null,
    source: 'test',
    changed_at: db.fn.now()
  })

const erased_for = async (play_type) => {
  const rows = await erased_role_attribution_by_play_type()
  const row = rows.find((r) => r.play_type === play_type)
  return row || { play_type, scanned: 0, erased: 0, resolvable: 0, restored: 0 }
}

describe('role-attribution-erased check', function () {
  // Deliberately no nfl_games row: the predicate joins play_changelog to
  // nfl_plays only, and nfl_games carries a natural-key unique constraint that
  // the shared from-plays fixtures already occupy for (2025, week 1, ZZ/OP).
  beforeEach(async () => {
    await db('nfl_plays').where({ esbid }).del()
    await db('play_changelog').where({ esbid }).del()
  })

  it('a restored row is not a finding', async () => {
    await insert_play({
      play_type: 'NOPL',
      passer_pid: 'TEST-PSSR-000001',
      passer_gsis_player_id: '00-0012345'
    })
    await insert_clear()

    const row = await erased_for('NOPL')
    expect(row.scanned).to.equal(1)
    expect(row.restored).to.equal(1)
    expect(row.erased).to.equal(0)
  })

  it('the RESIDUAL shape is not a finding here — that is the other oracle', async () => {
    // gsis survives, pid is null. This is what the role-pid residual monitor
    // fires on, and it is NOT a loss: the identity is still recoverable.
    await insert_play({
      play_type: 'NOPL',
      passer_gsis_player_id: '00-0012345'
    })
    await insert_clear()

    const row = await erased_for('NOPL')
    expect(row.scanned).to.equal(1)
    expect(row.resolvable).to.equal(1)
    expect(row.erased).to.equal(0)
  })

  it('THE CONTROL: the repair that greens the residual monitor reds this check', async () => {
    // Same row as above, then the "obvious repair" for the residual reading --
    // clear the gsis. The residual monitor now reports zero. This check must
    // report one, because the identity is gone.
    await insert_play({
      play_type: 'NOPL',
      passer_gsis_player_id: '00-0012345'
    })
    await insert_clear()
    expect((await erased_for('NOPL')).erased).to.equal(0)

    await db('nfl_plays')
      .where({ esbid, play_id })
      .update({ passer_gsis_player_id: null })

    const row = await erased_for('NOPL')
    expect(row.scanned).to.equal(1)
    expect(row.resolvable).to.equal(0)
    expect(row.erased).to.equal(1)
  })

  it('an erased PASS row is out of scope — clearing is transient there', async () => {
    await insert_play({ play_type: 'PASS' })
    await insert_clear()

    const rows = await erased_role_attribution_by_play_type()
    expect(rows.find((r) => r.play_type === 'PASS')).to.equal(undefined)
  })

  it('a row with no changelog clear is not scanned at all', async () => {
    // Never attributed is not the same as erased. Without this the check would
    // report every NOPL play that never had a passer.
    await insert_play({ play_type: 'NOPL' })

    expect((await erased_for('NOPL')).scanned).to.equal(0)
  })
})
