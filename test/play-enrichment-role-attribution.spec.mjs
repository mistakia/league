/* global describe it */

import * as chai from 'chai'

import { compute_play_changes } from '#libs-server'
import { enrich_player_identifications } from '#libs-server/play-enrichment/player-identification-enrichment.mjs'

chai.should()
const expect = chai.expect

// Minimal player_cache stub. Yields a pid for any gsisid present in pid_by_gsis,
// otherwise null (mirroring find_player's not-found behavior).
const make_player_cache = (pid_by_gsis = {}) => ({
  find_player: ({ gsisid }) => {
    if (pid_by_gsis[gsisid]) {
      return { pid: pid_by_gsis[gsisid] }
    }
    return null
  }
})

// Build a play_stats row. statId determines role; gsisId is the actor.
const play_stat = ({ esbid, playId, statId, gsisId }) => ({
  esbid,
  playId,
  statId,
  gsisId
})

describe('compute_play_changes clearable_fields', function () {
  const base_row = { esbid: 1, playId: 100, solo_tackle_1_pid: 'PID_X' }

  it('null rhs on clearable prop with truthy lhs writes NULL and emits changelog', () => {
    const { field_updates, changelog_entries, changes_count } =
      compute_play_changes({
        play_row: base_row,
        update: { solo_tackle_1_pid: null },
        clearable_fields: new Set(['solo_tackle_1_pid'])
      })

    expect(changes_count).to.equal(1)
    expect(field_updates).to.have.property('solo_tackle_1_pid', null)
    expect(changelog_entries).to.have.lengthOf(1)
    expect(changelog_entries[0]).to.include({
      prop: 'solo_tackle_1_pid',
      prev: 'PID_X',
      new: null
    })
  })

  it('null rhs on clearable prop with empty-string lhs no-ops (already empty)', () => {
    const { field_updates, changelog_entries, changes_count } =
      compute_play_changes({
        play_row: { ...base_row, solo_tackle_1_pid: '' },
        update: { solo_tackle_1_pid: null },
        clearable_fields: new Set(['solo_tackle_1_pid'])
      })

    expect(changes_count).to.equal(0)
    expect(field_updates).to.deep.equal({})
    expect(changelog_entries).to.have.lengthOf(0)
  })

  it('null rhs on a prop NOT in clearable_fields is skipped (regression guard)', () => {
    const { changes_count, field_updates } = compute_play_changes({
      play_row: base_row,
      update: { solo_tackle_1_pid: null },
      clearable_fields: new Set() // empty -> default callers preserved
    })

    expect(changes_count).to.equal(0)
    expect(field_updates).to.deep.equal({})
  })

  it('clearable_fields ownership bypasses overwrite gate (X-to-Y same slot)', () => {
    // Same role, different player: enrichment owns the slot and must
    // overwrite the stale value even without --overwrite-existing.
    const { changes_count, field_updates, changelog_entries } =
      compute_play_changes({
        play_row: base_row,
        update: { solo_tackle_1_pid: 'PID_Y' },
        clearable_fields: new Set(['solo_tackle_1_pid'])
      })

    expect(changes_count).to.equal(1)
    expect(field_updates).to.have.property('solo_tackle_1_pid', 'PID_Y')
    expect(changelog_entries[0]).to.include({ prev: 'PID_X', new: 'PID_Y' })
  })

  it('non-clearable existing caller (no clearable_fields arg) behaves unchanged', () => {
    // Sportradar / manual-CLI code path: no clearable_fields, default empty
    // Set. Null/empty/undefined rhs all skipped; truthy rhs blocked by
    // overwrite gate when lhs is truthy.
    const r1 = compute_play_changes({
      play_row: { esbid: 1, playId: 100, psr_pid: 'PID_X' },
      update: { psr_pid: null }
    })
    expect(r1.changes_count).to.equal(0)

    const r2 = compute_play_changes({
      play_row: { esbid: 1, playId: 100, psr_pid: 'PID_X' },
      update: { psr_pid: 'PID_Y' }
    })
    expect(r2.changes_count).to.equal(0) // overwrite gate blocks
  })
})

describe('enrich_player_identifications tackle family ownership', function () {
  const esbid = 1
  const playId = 100

  it('X-to-Y reattribution clears stale solo_tackle and writes tackle_assist', () => {
    // Existing play row: solo_tackle_1 = X (from a prior import).
    // New play_stats: statId 82 (tackle_assist) for Y, no statId 79.
    const play_row = {
      esbid,
      playId,
      solo_tackle_1_gsis: 'GSIS_X',
      solo_tackle_1_pid: 'PID_X'
    }
    const stats = [play_stat({ esbid, playId, statId: 82, gsisId: 'GSIS_Y' })]
    const cache = make_player_cache({ GSIS_X: 'PID_X', GSIS_Y: 'PID_Y' })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    // Solo tackle slot cleared (statId 79 absent, owned family)
    expect(enriched.solo_tackle_1_gsis).to.equal(null)
    expect(enriched.solo_tackle_1_pid).to.equal(null)
    // tackle_assist slot 1 gets Y
    expect(enriched.tackle_assist_1_gsis).to.equal('GSIS_Y')
    expect(enriched.tackle_assist_1_pid).to.equal('PID_Y')
    // Other tackle_assist slots NULL-padded
    expect(enriched.tackle_assist_2_gsis).to.equal(null)
    expect(enriched.tackle_assist_2_pid).to.equal(null)
  })

  it('family-owned NULL-clear: play has play_stats but no tackle statIds', () => {
    // Play has bc stat (statId 10) but no tackle stats. Existing tackle
    // attribution on the play row must clear.
    const play_row = {
      esbid,
      playId,
      solo_tackle_1_gsis: 'GSIS_X',
      solo_tackle_1_pid: 'PID_X',
      assisted_tackle_2_gsis: 'GSIS_Z',
      assisted_tackle_2_pid: 'PID_Z'
    }
    const stats = [play_stat({ esbid, playId, statId: 10, gsisId: 'GSIS_BC' })]
    const cache = make_player_cache({
      GSIS_BC: 'PID_BC',
      GSIS_X: 'PID_X',
      GSIS_Z: 'PID_Z'
    })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.solo_tackle_1_gsis).to.equal(null)
    expect(enriched.solo_tackle_1_pid).to.equal(null)
    expect(enriched.assisted_tackle_2_gsis).to.equal(null)
    expect(enriched.assisted_tackle_2_pid).to.equal(null)
  })

  it('live-game preservation: zero play_stats rows leaves tackle columns untouched', () => {
    const play_row = {
      esbid,
      playId,
      solo_tackle_1_gsis: 'GSIS_X',
      solo_tackle_1_pid: 'PID_X'
    }
    const cache = make_player_cache({ GSIS_X: 'PID_X' })

    const [enriched] = enrich_player_identifications([play_row], [], cache)

    // No play_stats -> no-op for tackle family; existing values preserved.
    expect(enriched.solo_tackle_1_gsis).to.equal('GSIS_X')
    expect(enriched.solo_tackle_1_pid).to.equal('PID_X')
  })

  it('all-null pid resolve: tackle gsisids miss player cache, slots still NULL-write', () => {
    // play_stats carries a statId 79 with an unknown gsisid. Slot should
    // NULL-write (clearing any stale prior value); _gsis records the unknown
    // gsisid but _pid is null.
    const play_row = {
      esbid,
      playId,
      solo_tackle_1_gsis: 'GSIS_OLD',
      solo_tackle_1_pid: 'PID_OLD'
    }
    const stats = [
      play_stat({ esbid, playId, statId: 79, gsisId: 'GSIS_UNKNOWN' })
    ]
    const cache = make_player_cache({}) // no players resolve

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.solo_tackle_1_gsis).to.equal('GSIS_UNKNOWN')
    expect(enriched.solo_tackle_1_pid).to.equal(null)
    // Slot 2/3 NULL-padded
    expect(enriched.solo_tackle_2_pid).to.equal(null)
  })

  it('happy path: statId 79 + 82 attribute solo_tackle_1 and tackle_assist_1', () => {
    const play_row = { esbid, playId }
    const stats = [
      play_stat({ esbid, playId, statId: 79, gsisId: 'GSIS_A' }),
      play_stat({ esbid, playId, statId: 82, gsisId: 'GSIS_B' })
    ]
    const cache = make_player_cache({ GSIS_A: 'PID_A', GSIS_B: 'PID_B' })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.solo_tackle_1_gsis).to.equal('GSIS_A')
    expect(enriched.solo_tackle_1_pid).to.equal('PID_A')
    expect(enriched.tackle_assist_1_gsis).to.equal('GSIS_B')
    expect(enriched.tackle_assist_1_pid).to.equal('PID_B')
    // Remaining slots NULL-padded
    expect(enriched.solo_tackle_2_gsis).to.equal(null)
    expect(enriched.solo_tackle_2_pid).to.equal(null)
    expect(enriched.solo_tackle_3_gsis).to.equal(null)
    expect(enriched.solo_tackle_3_pid).to.equal(null)
  })
})

