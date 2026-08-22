/* global describe it */

import * as chai from 'chai'

import { compute_play_changes } from '#libs-server'
import { enrich_player_identifications } from '#libs-server/play-enrichment/player-identification-enrichment.mjs'

chai.should()
const expect = chai.expect

// Minimal player_cache stub. Yields a pid for any gsis_player_id present in
// pid_by_gsis, otherwise null (mirroring find_player's not-found behavior).
const make_player_cache = (pid_by_gsis = {}) => ({
  find_player: ({ gsis_player_id }) => {
    if (pid_by_gsis[gsis_player_id]) {
      return { pid: pid_by_gsis[gsis_player_id] }
    }
    return null
  }
})

// Build a play_stats row. stat_id determines role; gsis_player_id is the actor.
const play_stat = ({ esbid, play_id, stat_id, gsis_player_id }) => ({
  esbid,
  play_id,
  stat_id,
  gsis_player_id
})

describe('compute_play_changes clearable_fields', function () {
  const base_row = { esbid: 1, play_id: 100, solo_tackle_1_pid: 'PID_X' }

  it('null rhs on clearable prop with truthy lhs writes NULL and emits changelog', () => {
    const { field_updates, changelog_entries, changes_count } =
      compute_play_changes({
        play_row: base_row,
        update: { solo_tackle_1_pid: null },
        clearable_fields: new Set(['solo_tackle_1_pid']),
        source: 'test'
      })

    expect(changes_count).to.equal(1)
    expect(field_updates).to.have.property('solo_tackle_1_pid', null)
    expect(changelog_entries).to.have.lengthOf(1)
    expect(changelog_entries[0]).to.include({
      column_name: 'solo_tackle_1_pid',
      previous_value: 'PID_X',
      new_value: null,
      source: 'test'
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
        clearable_fields: new Set(['solo_tackle_1_pid']),
        source: 'test'
      })

    expect(changes_count).to.equal(1)
    expect(field_updates).to.have.property('solo_tackle_1_pid', 'PID_Y')
    expect(changelog_entries[0]).to.include({
      previous_value: 'PID_X',
      new_value: 'PID_Y'
    })
  })

  it('non-clearable existing caller (no clearable_fields arg) behaves unchanged', () => {
    // Sportradar / manual-CLI code path: no clearable_fields, default empty
    // Set. Null/empty/undefined rhs all skipped; truthy rhs blocked by
    // overwrite gate when lhs is truthy.
    const r1 = compute_play_changes({
      play_row: { esbid: 1, play_id: 100, passer_pid: 'PID_X' },
      update: { passer_pid: null }
    })
    expect(r1.changes_count).to.equal(0)

    const r2 = compute_play_changes({
      play_row: { esbid: 1, play_id: 100, passer_pid: 'PID_X' },
      update: { passer_pid: 'PID_Y' }
    })
    expect(r2.changes_count).to.equal(0) // overwrite gate blocks
  })
})

describe('enrich_player_identifications tackle family ownership', function () {
  const esbid = 1
  const play_id = 100

  it('X-to-Y reattribution clears stale solo_tackle and writes tackle_assist', () => {
    // Existing play row: solo_tackle_1 = X (from a prior import).
    // New play_stats: stat_id 82 (tackle_assist) for Y, no stat_id 79.
    const play_row = {
      esbid,
      play_id,
      solo_tackle_1_gsis: 'GSIS_X',
      solo_tackle_1_pid: 'PID_X'
    }
    const stats = [
      play_stat({ esbid, play_id, stat_id: 82, gsis_player_id: 'GSIS_Y' })
    ]
    const cache = make_player_cache({ GSIS_X: 'PID_X', GSIS_Y: 'PID_Y' })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    // Solo tackle slot cleared (stat_id 79 absent, owned family)
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
    // Play has bc stat (stat_id 10) but no tackle stats. Existing tackle
    // attribution on the play row must clear.
    const play_row = {
      esbid,
      play_id,
      solo_tackle_1_gsis: 'GSIS_X',
      solo_tackle_1_pid: 'PID_X',
      assisted_tackle_2_gsis: 'GSIS_Z',
      assisted_tackle_2_pid: 'PID_Z'
    }
    const stats = [
      play_stat({ esbid, play_id, stat_id: 10, gsis_player_id: 'GSIS_BC' })
    ]
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
      play_id,
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
    // play_stats carries a stat_id 79 with an unknown gsisid. Slot should
    // NULL-write (clearing any stale prior value); _gsis records the unknown
    // gsisid but _pid is null.
    const play_row = {
      esbid,
      play_id,
      solo_tackle_1_gsis: 'GSIS_OLD',
      solo_tackle_1_pid: 'PID_OLD'
    }
    const stats = [
      play_stat({ esbid, play_id, stat_id: 79, gsis_player_id: 'GSIS_UNKNOWN' })
    ]
    const cache = make_player_cache({}) // no players resolve

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.solo_tackle_1_gsis).to.equal('GSIS_UNKNOWN')
    expect(enriched.solo_tackle_1_pid).to.equal(null)
    // Slot 2/3 NULL-padded
    expect(enriched.solo_tackle_2_pid).to.equal(null)
  })

  it('happy path: stat_id 79 + 82 attribute solo_tackle_1 and tackle_assist_1', () => {
    const play_row = { esbid, play_id }
    const stats = [
      play_stat({ esbid, play_id, stat_id: 79, gsis_player_id: 'GSIS_A' }),
      play_stat({ esbid, play_id, stat_id: 82, gsis_player_id: 'GSIS_B' })
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

describe('enrich_player_identifications single-player family ownership', function () {
  const esbid = 1
  const play_id = 100

  it('bc family: stat_id 10 attributes ball_carrier_gsis_player_id/ball_carrier_pid; no overwrite gate', () => {
    // Existing stale ball_carrier_pid on the play row; new play_stats names a
    // different ball-carrier. Owned writer must overwrite, not short-circuit.
    const play_row = {
      esbid,
      play_id,
      ball_carrier_gsis_player_id: 'GSIS_OLD',
      ball_carrier_pid: 'PID_OLD'
    }
    const stats = [
      play_stat({ esbid, play_id, stat_id: 10, gsis_player_id: 'GSIS_NEW' })
    ]
    const cache = make_player_cache({
      GSIS_OLD: 'PID_OLD',
      GSIS_NEW: 'PID_NEW'
    })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.ball_carrier_gsis_player_id).to.equal('GSIS_NEW')
    expect(enriched.ball_carrier_pid).to.equal('PID_NEW')
  })

  it('psr family: family-owned NULL-clear when the play row holds nothing to preserve', () => {
    // Play has only a tackle stat (stat_id 79); psr family is owned but empty
    // and the play row carries no passer gsis -> both columns NULL-write.
    const play_row = { esbid, play_id }
    const stats = [
      play_stat({ esbid, play_id, stat_id: 79, gsis_player_id: 'GSIS_T' })
    ]
    const cache = make_player_cache({ GSIS_T: 'PID_T' })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.passer_gsis_player_id).to.equal(null)
    expect(enriched.passer_pid).to.equal(null)
  })

  it('trg / intp / fuml gating by stat_id set', () => {
    // stat_id 21 (trg), 25 (intp), 52 (fuml) each attribute their family.
    const play_row = { esbid, play_id }
    const stats = [
      play_stat({ esbid, play_id, stat_id: 21, gsis_player_id: 'GSIS_TRG' }),
      play_stat({ esbid, play_id, stat_id: 25, gsis_player_id: 'GSIS_INTP' }),
      play_stat({ esbid, play_id, stat_id: 52, gsis_player_id: 'GSIS_FUML' })
    ]
    const cache = make_player_cache({
      GSIS_TRG: 'PID_TRG',
      GSIS_INTP: 'PID_INTP',
      GSIS_FUML: 'PID_FUML'
    })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.target_gsis_player_id).to.equal('GSIS_TRG')
    expect(enriched.target_pid).to.equal('PID_TRG')
    expect(enriched.interceptor_gsis_player_id).to.equal('GSIS_INTP')
    expect(enriched.interceptor_pid).to.equal('PID_INTP')
    expect(enriched.fumble_lost_gsis_player_id).to.equal('GSIS_FUML')
    expect(enriched.fumble_lost_pid).to.equal('PID_FUML')
    // bc family is owned (has_any_play_stats) but no stat_id 10/11 -> cleared.
    expect(enriched.ball_carrier_gsis_player_id).to.equal(null)
    expect(enriched.ball_carrier_pid).to.equal(null)
  })

  it('trg family: stat_id 115 (target) attributes target_pid on an incomplete pass', () => {
    // Regression: incomplete passes carry the intended receiver ONLY via
    // stat_id 115 (no 21/22). A gate of [21,22] NULL-cleared every incomplete
    // target, collapsing targets-from-plays to receptions. stat_id 115 must
    // attribute target_pid.
    const play_row = { esbid, play_id }
    const stats = [
      play_stat({ esbid, play_id, stat_id: 115, gsis_player_id: 'GSIS_TRG' })
    ]
    const cache = make_player_cache({ GSIS_TRG: 'PID_TRG' })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.target_gsis_player_id).to.equal('GSIS_TRG')
    expect(enriched.target_pid).to.equal('PID_TRG')
  })

  it('trg family: stat_id 113 (yards after catch) attributes target_pid', () => {
    const play_row = { esbid, play_id }
    const stats = [
      play_stat({ esbid, play_id, stat_id: 113, gsis_player_id: 'GSIS_TRG' })
    ]
    const cache = make_player_cache({ GSIS_TRG: 'PID_TRG' })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.target_pid).to.equal('PID_TRG')
  })

  it('psr family: stat_id 19 (interception) attributes passer_pid', () => {
    // Regression: interception plays credit the passer ONLY via stat_id 19
    // (no 14/15/16/20). A gate of [14,15,16,20] NULL-cleared the passer on
    // every interception. stat_id 19 must attribute passer_pid.
    const play_row = { esbid, play_id }
    const stats = [
      play_stat({ esbid, play_id, stat_id: 19, gsis_player_id: 'GSIS_QB' })
    ]
    const cache = make_player_cache({ GSIS_QB: 'PID_QB' })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.passer_gsis_player_id).to.equal('GSIS_QB')
    expect(enriched.passer_pid).to.equal('PID_QB')
  })

  it('psr family: stat_id 112 (air yards incomplete) attributes passer_pid', () => {
    const play_row = { esbid, play_id }
    const stats = [
      play_stat({ esbid, play_id, stat_id: 112, gsis_player_id: 'GSIS_QB' })
    ]
    const cache = make_player_cache({ GSIS_QB: 'PID_QB' })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.passer_pid).to.equal('PID_QB')
  })

  it('sportradar interaction: sportradar-written passer_pid is overwritten when play_stats lands a different passer', () => {
    // Sportradar wrote {passer_gsis_player_id: GSIS_SR, passer_pid: PID_SR} before play_stats
    // imported. play_stats arrives with a different passer (stat_id 14).
    // Owned writer overwrites both columns without --overwrite-existing.
    const play_row = {
      esbid,
      play_id,
      passer_gsis_player_id: 'GSIS_SR',
      passer_pid: 'PID_SR'
    }
    const stats = [
      play_stat({ esbid, play_id, stat_id: 14, gsis_player_id: 'GSIS_REAL' })
    ]
    const cache = make_player_cache({
      GSIS_SR: 'PID_SR',
      GSIS_REAL: 'PID_REAL'
    })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.passer_gsis_player_id).to.equal('GSIS_REAL')
    expect(enriched.passer_pid).to.equal('PID_REAL')
  })

  it('penalty family remains on legacy OR-fallback path (unchanged)', () => {
    // Penalty has no play_stats source. Existing play-row penalty_player_gsis
    // is preserved and resolved to a pid via the legacy mapper.
    const play_row = {
      esbid,
      play_id,
      penalty_player_gsis: 'GSIS_PEN'
    }
    const stats = [
      play_stat({ esbid, play_id, stat_id: 79, gsis_player_id: 'GSIS_T' })
    ]
    const cache = make_player_cache({ GSIS_PEN: 'PID_PEN', GSIS_T: 'PID_T' })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    // Penalty pid resolved from existing play-row gsis -- not cleared.
    expect(enriched.penalty_player_gsis).to.equal('GSIS_PEN')
    expect(enriched.penalty_player_pid).to.equal('PID_PEN')
  })

  it('live-game window: zero play_stats leaves single-player columns untouched', () => {
    const play_row = {
      esbid,
      play_id,
      ball_carrier_gsis_player_id: 'GSIS_BC',
      ball_carrier_pid: 'PID_BC',
      passer_gsis_player_id: 'GSIS_QB',
      passer_pid: 'PID_QB'
    }
    const cache = make_player_cache({ GSIS_BC: 'PID_BC', GSIS_QB: 'PID_QB' })

    const [enriched] = enrich_player_identifications([play_row], [], cache)

    expect(enriched.ball_carrier_gsis_player_id).to.equal('GSIS_BC')
    expect(enriched.ball_carrier_pid).to.equal('PID_BC')
    expect(enriched.passer_gsis_player_id).to.equal('GSIS_QB')
    expect(enriched.passer_pid).to.equal('PID_QB')
  })
})

describe('enrich_player_identifications snap-roster fallback (source NULL gsis_player_id)', function () {
  const esbid = 2025110204
  const play_id = 1130

  // A role stat row the NFL feed emitted with player_name + clubCode but a NULL
  // gsis_player_id (the Jennings failure mode).
  const named_stat = ({
    stat_id,
    player_name,
    clubCode = 'NE',
    gsis_player_id = null
  }) => ({
    esbid,
    play_id,
    stat_id,
    gsis_player_id,
    player_name,
    clubCode
  })

  // esbid -> Map(normalized name -> [{ pid, gsisid }])
  const make_roster = (by_name) => {
    const inner = new Map(Object.entries(by_name))
    return new Map([[esbid, inner]])
  }

  it('recovers ball_carrier_pid from the snap roster when stat_id 10 gsis_player_id is NULL', () => {
    const play_row = { esbid, play_id }
    const stats = [named_stat({ stat_id: 10, player_name: 'T.Jennings' })]
    const cache = make_player_cache({ '00-0039757': 'TERR-JENN' })
    const roster = make_roster({
      't.jennings': [{ pid: 'TERR-JENN', gsisid: '00-0039757' }]
    })

    const [enriched] = enrich_player_identifications(
      [play_row],
      stats,
      cache,
      roster
    )

    expect(enriched.ball_carrier_gsis_player_id).to.equal('00-0039757')
    expect(enriched.ball_carrier_pid).to.equal('TERR-JENN')
  })

  it('abstains when two snap participants share the name (never guesses)', () => {
    const play_row = { esbid, play_id }
    const stats = [named_stat({ stat_id: 10, player_name: 'T.Jennings' })]
    const cache = make_player_cache({
      '00-0039757': 'TERR-JENN',
      '00-0099999': 'TREY-JENN'
    })
    const roster = make_roster({
      't.jennings': [
        { pid: 'TERR-JENN', gsisid: '00-0039757' },
        { pid: 'TREY-JENN', gsisid: '00-0099999' }
      ]
    })

    const [enriched] = enrich_player_identifications(
      [play_row],
      stats,
      cache,
      roster
    )

    expect(enriched.ball_carrier_gsis_player_id).to.equal(null)
    expect(enriched.ball_carrier_pid).to.equal(null)
  })

  it('abstains when the stat-row name is not in the game roster', () => {
    const play_row = { esbid, play_id }
    const stats = [named_stat({ stat_id: 10, player_name: 'T.Jennings' })]
    const cache = make_player_cache({ '00-0039757': 'TERR-JENN' })
    const roster = make_roster({
      'd.maye': [{ pid: 'DRAK-MAYE', gsisid: '00-0039999' }]
    })

    const [enriched] = enrich_player_identifications(
      [play_row],
      stats,
      cache,
      roster
    )

    expect(enriched.ball_carrier_pid).to.equal(null)
  })

  it('no roster arg: source NULL gsis_player_id stays NULL-cleared (legacy behavior)', () => {
    const play_row = {
      esbid,
      play_id,
      ball_carrier_gsis_player_id: 'GSIS_STALE',
      ball_carrier_pid: 'PID_STALE'
    }
    const stats = [named_stat({ stat_id: 10, player_name: 'T.Jennings' })]
    const cache = make_player_cache({ '00-0039757': 'TERR-JENN' })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.ball_carrier_gsis_player_id).to.equal(null)
    expect(enriched.ball_carrier_pid).to.equal(null)
  })

  it('feed-provided gsis_player_id takes precedence over the fallback', () => {
    const play_row = { esbid, play_id }
    // Feed gave the real gsis_player_id; the roster holds a different (wrong) name match.
    // The primary path must win and the fallback must not fire.
    const stats = [
      named_stat({
        stat_id: 10,
        player_name: 'T.Jennings',
        gsis_player_id: '00-0039757'
      })
    ]
    const cache = make_player_cache({
      '00-0039757': 'TERR-JENN',
      '00-0011111': 'WRONG'
    })
    const roster = make_roster({
      't.jennings': [{ pid: 'WRONG', gsisid: '00-0011111' }]
    })

    const [enriched] = enrich_player_identifications(
      [play_row],
      stats,
      cache,
      roster
    )

    expect(enriched.ball_carrier_gsis_player_id).to.equal('00-0039757')
    expect(enriched.ball_carrier_pid).to.equal('TERR-JENN')
  })
})

describe('enrich_player_identifications play-row resolution state (family statIds absent)', function () {
  const esbid = 1
  const play_id = 100

  // The writer is play-type blind -- it never reads play_type. What separates
  // these cases is whether the family's statIds are present, which is the
  // observable the writer keys on. play_type is carried on the rows only to
  // name the production class each case stands for.

  it('NOPL pass: preserves the play-row passer gsis and resolves a pid', () => {
    // A penalty-nullified pass. A real pass was thrown and the play row holds
    // the passer, but the NFL stat ledger books no passing statIds for it. The
    // owned writer used to read that silence as "no passer" and delete both
    // columns on every game finalize.
    const play_row = {
      esbid,
      play_id,
      play_type: 'NOPL',
      passer_gsis_player_id: 'GSIS_QB',
      passer_pid: null
    }
    const stats = [
      play_stat({ esbid, play_id, stat_id: 93, gsis_player_id: 'GSIS_PEN' })
    ]
    const cache = make_player_cache({ GSIS_QB: 'PID_QB', GSIS_PEN: 'PID_PEN' })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.passer_gsis_player_id).to.equal('GSIS_QB')
    expect(enriched.passer_pid).to.equal('PID_QB')
  })

  it('two-point pass: preserves passer and target attribution', () => {
    // CONV. A real pass and a real reception, booked outside the standard
    // passing and receiving families.
    const play_row = {
      esbid,
      play_id,
      play_type: 'CONV',
      passer_gsis_player_id: 'GSIS_QB',
      passer_pid: null,
      target_gsis_player_id: 'GSIS_WR',
      target_pid: null
    }
    const stats = [
      play_stat({ esbid, play_id, stat_id: 79, gsis_player_id: 'GSIS_T' })
    ]
    const cache = make_player_cache({
      GSIS_QB: 'PID_QB',
      GSIS_WR: 'PID_WR',
      GSIS_T: 'PID_T'
    })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.passer_gsis_player_id).to.equal('GSIS_QB')
    expect(enriched.passer_pid).to.equal('PID_QB')
    expect(enriched.target_gsis_player_id).to.equal('GSIS_WR')
    expect(enriched.target_pid).to.equal('PID_WR')
  })

  it('ordinary pass: the feed still wins over a stale play-row value', () => {
    // Regression guard on state 1. The family's statIds ARE present, so the
    // play-row resolution state must not fire and must not shield a stale
    // value from reattribution.
    const play_row = {
      esbid,
      play_id,
      play_type: 'PASS',
      passer_gsis_player_id: 'GSIS_STALE',
      passer_pid: 'PID_STALE'
    }
    const stats = [
      play_stat({ esbid, play_id, stat_id: 15, gsis_player_id: 'GSIS_QB' })
    ]
    const cache = make_player_cache({
      GSIS_STALE: 'PID_STALE',
      GSIS_QB: 'PID_QB'
    })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.passer_gsis_player_id).to.equal('GSIS_QB')
    expect(enriched.passer_pid).to.equal('PID_QB')
  })

  it('genuinely no participant: nothing to preserve, both columns NULL-write', () => {
    // A kickoff. No passer statIds and no passer on the play row -- the
    // clearing branch is still reachable and still runs.
    const play_row = { esbid, play_id, play_type: 'KOFF' }
    const stats = [
      play_stat({ esbid, play_id, stat_id: 79, gsis_player_id: 'GSIS_T' })
    ]
    const cache = make_player_cache({ GSIS_T: 'PID_T' })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.passer_gsis_player_id).to.equal(null)
    expect(enriched.passer_pid).to.equal(null)
    expect(enriched.target_gsis_player_id).to.equal(null)
    expect(enriched.target_pid).to.equal(null)
    expect(enriched.ball_carrier_gsis_player_id).to.equal(null)
    expect(enriched.ball_carrier_pid).to.equal(null)
  })

  it('unresolvable play-row gsis: preserves the gsis and leaves an existing pid alone', () => {
    // The translation gap. find_player cannot resolve the gsis, so the state
    // abstains rather than writing NULL over either column -- it never
    // destroys, it only adds.
    const play_row = {
      esbid,
      play_id,
      play_type: 'NOPL',
      passer_gsis_player_id: 'GSIS_UNTRANSLATABLE',
      passer_pid: 'PID_FROM_ELSEWHERE'
    }
    const stats = [
      play_stat({ esbid, play_id, stat_id: 79, gsis_player_id: 'GSIS_T' })
    ]
    const cache = make_player_cache({ GSIS_T: 'PID_T' })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.passer_gsis_player_id).to.equal('GSIS_UNTRANSLATABLE')
    expect(enriched.passer_pid).to.equal('PID_FROM_ELSEWHERE')
  })

  it('statIds present but gsisId NULL: the clear is a real retraction and still happens', () => {
    // The boundary the state is deliberately scoped away from. Here the feed
    // DID speak about the role and named nobody, which is different from never
    // mentioning it. The snap-roster fallback owns this case, not this state.
    const play_row = {
      esbid,
      play_id,
      play_type: 'RUSH',
      ball_carrier_gsis_player_id: 'GSIS_STALE',
      ball_carrier_pid: 'PID_STALE'
    }
    const stats = [
      { esbid, play_id, stat_id: 10, gsis_player_id: null, player_name: 'T.X' }
    ]
    const cache = make_player_cache({ GSIS_STALE: 'PID_STALE' })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.ball_carrier_gsis_player_id).to.equal(null)
    expect(enriched.ball_carrier_pid).to.equal(null)
  })
})

describe('enrich_player_identifications psr family sack-row attribution', function () {
  const esbid = 1
  const play_id = 100

  it('stat_id 20 alone (sack row, 2023+ feed shape) attributes psr to the QB', () => {
    // 2023+ upstream feed: sack rows omit statIds 14/15/16. stat_id 20 (Pass
    // Sack) is charged to the QB. statIds 110/120 name the sacker, not the QB.
    const play_row = { esbid, play_id, sk: true }
    const stats = [
      play_stat({ esbid, play_id, stat_id: 20, gsis_player_id: 'GSIS_QB' }),
      play_stat({ esbid, play_id, stat_id: 79, gsis_player_id: 'GSIS_SACKER' }),
      play_stat({
        esbid,
        play_id,
        stat_id: 110,
        gsis_player_id: 'GSIS_SACKER'
      }),
      play_stat({ esbid, play_id, stat_id: 120, gsis_player_id: 'GSIS_SACKER' })
    ]
    const cache = make_player_cache({
      GSIS_QB: 'PID_QB',
      GSIS_SACKER: 'PID_SACKER'
    })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.passer_gsis_player_id).to.equal('GSIS_QB')
    expect(enriched.passer_pid).to.equal('PID_QB')
  })

  it('normal pass completion (statIds 14/15/16) still resolves psr correctly', () => {
    // Regression guard: legacy non-sack pass-completion shape unaffected.
    const play_row = { esbid, play_id }
    const stats = [
      play_stat({ esbid, play_id, stat_id: 15, gsis_player_id: 'GSIS_QB' }),
      play_stat({ esbid, play_id, stat_id: 16, gsis_player_id: 'GSIS_QB' }),
      play_stat({ esbid, play_id, stat_id: 21, gsis_player_id: 'GSIS_WR' })
    ]
    const cache = make_player_cache({ GSIS_QB: 'PID_QB', GSIS_WR: 'PID_WR' })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.passer_gsis_player_id).to.equal('GSIS_QB')
    expect(enriched.passer_pid).to.equal('PID_QB')
  })
})

describe('compute_play_changes defensive: lhs undefined on clearable prop', function () {
  it('rhs null with lhs undefined (Knex never-set column) is a no-op', () => {
    // deep-diff emits kind:N for new keys with rhs:null when lhs is
    // undefined. compute_play_changes filters to kind:E only, so this is
    // silently dropped -- which is the correct behavior because there's
    // no prior value to clear.
    const { changes_count, field_updates } = compute_play_changes({
      play_row: { esbid: 1, play_id: 100 },
      update: { solo_tackle_1_pid: null },
      clearable_fields: new Set(['solo_tackle_1_pid'])
    })

    expect(changes_count).to.equal(0)
    expect(field_updates).to.deep.equal({})
  })
})

describe('yardage-stat-enrichment _gsis emission contract', function () {
  it('emits no _gsis fields after Phase B Task 11 migration', async () => {
    const { enrich_yardage_stats } =
      await import('#libs-server/play-enrichment/yardage-stat-enrichment.mjs')
    const esbid = 1
    const play_id = 100
    // stat_id 11 is rushing yards (bc). Pre-Task-11 this would have emitted ball_carrier_gsis_player_id.
    const stat = play_stat({
      esbid,
      play_id,
      stat_id: 11,
      gsis_player_id: 'GSIS_BC'
    })
    stat.stat_yards = 5

    const [enriched] = enrich_yardage_stats([{ esbid, play_id }], [stat])

    expect(enriched).to.not.have.property('ball_carrier_gsis_player_id')
    expect(enriched).to.not.have.property('passer_gsis_player_id')
    expect(enriched).to.not.have.property('target_gsis_player_id')
    expect(enriched).to.not.have.property('interceptor_gsis_player_id')
    expect(enriched).to.not.have.property('fumble_lost_gsis_player_id')
  })
})
