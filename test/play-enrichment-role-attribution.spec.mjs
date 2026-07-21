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

describe('enrich_player_identifications single-player family ownership', function () {
  const esbid = 1
  const playId = 100

  it('bc family: statId 10 attributes bc_gsis/bc_pid; no overwrite gate', () => {
    // Existing stale bc_pid on the play row; new play_stats names a
    // different ball-carrier. Owned writer must overwrite, not short-circuit.
    const play_row = { esbid, playId, bc_gsis: 'GSIS_OLD', bc_pid: 'PID_OLD' }
    const stats = [play_stat({ esbid, playId, statId: 10, gsisId: 'GSIS_NEW' })]
    const cache = make_player_cache({
      GSIS_OLD: 'PID_OLD',
      GSIS_NEW: 'PID_NEW'
    })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.bc_gsis).to.equal('GSIS_NEW')
    expect(enriched.bc_pid).to.equal('PID_NEW')
  })

  it('psr family: family-owned NULL-clear when play has stats but no statId 14/15/16', () => {
    // Play has only a tackle stat (statId 79); psr family is owned but
    // empty -> NULL-clear stale psr columns from a prior import.
    const play_row = {
      esbid,
      playId,
      psr_gsis: 'GSIS_QB',
      psr_pid: 'PID_QB'
    }
    const stats = [play_stat({ esbid, playId, statId: 79, gsisId: 'GSIS_T' })]
    const cache = make_player_cache({ GSIS_QB: 'PID_QB', GSIS_T: 'PID_T' })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.psr_gsis).to.equal(null)
    expect(enriched.psr_pid).to.equal(null)
  })

  it('trg / intp / fuml gating by statId set', () => {
    // statId 21 (trg), 25 (intp), 52 (fuml) each attribute their family.
    const play_row = { esbid, playId }
    const stats = [
      play_stat({ esbid, playId, statId: 21, gsisId: 'GSIS_TRG' }),
      play_stat({ esbid, playId, statId: 25, gsisId: 'GSIS_INTP' }),
      play_stat({ esbid, playId, statId: 52, gsisId: 'GSIS_FUML' })
    ]
    const cache = make_player_cache({
      GSIS_TRG: 'PID_TRG',
      GSIS_INTP: 'PID_INTP',
      GSIS_FUML: 'PID_FUML'
    })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.trg_gsis).to.equal('GSIS_TRG')
    expect(enriched.trg_pid).to.equal('PID_TRG')
    expect(enriched.intp_gsis).to.equal('GSIS_INTP')
    expect(enriched.intp_pid).to.equal('PID_INTP')
    expect(enriched.player_fuml_gsis).to.equal('GSIS_FUML')
    expect(enriched.player_fuml_pid).to.equal('PID_FUML')
    // bc family is owned (has_any_play_stats) but no statId 10/11 -> cleared.
    expect(enriched.bc_gsis).to.equal(null)
    expect(enriched.bc_pid).to.equal(null)
  })

  it('trg family: statId 115 (target) attributes trg_pid on an incomplete pass', () => {
    // Regression: incomplete passes carry the intended receiver ONLY via
    // statId 115 (no 21/22). A gate of [21,22] NULL-cleared every incomplete
    // target, collapsing targets-from-plays to receptions. statId 115 must
    // attribute trg_pid.
    const play_row = { esbid, playId }
    const stats = [
      play_stat({ esbid, playId, statId: 115, gsisId: 'GSIS_TRG' })
    ]
    const cache = make_player_cache({ GSIS_TRG: 'PID_TRG' })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.trg_gsis).to.equal('GSIS_TRG')
    expect(enriched.trg_pid).to.equal('PID_TRG')
  })

  it('trg family: statId 113 (yards after catch) attributes trg_pid', () => {
    const play_row = { esbid, playId }
    const stats = [
      play_stat({ esbid, playId, statId: 113, gsisId: 'GSIS_TRG' })
    ]
    const cache = make_player_cache({ GSIS_TRG: 'PID_TRG' })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.trg_pid).to.equal('PID_TRG')
  })

  it('psr family: statId 19 (interception) attributes psr_pid', () => {
    // Regression: interception plays credit the passer ONLY via statId 19
    // (no 14/15/16/20). A gate of [14,15,16,20] NULL-cleared the passer on
    // every interception. statId 19 must attribute psr_pid.
    const play_row = { esbid, playId }
    const stats = [play_stat({ esbid, playId, statId: 19, gsisId: 'GSIS_QB' })]
    const cache = make_player_cache({ GSIS_QB: 'PID_QB' })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.psr_gsis).to.equal('GSIS_QB')
    expect(enriched.psr_pid).to.equal('PID_QB')
  })

  it('psr family: statId 112 (air yards incomplete) attributes psr_pid', () => {
    const play_row = { esbid, playId }
    const stats = [play_stat({ esbid, playId, statId: 112, gsisId: 'GSIS_QB' })]
    const cache = make_player_cache({ GSIS_QB: 'PID_QB' })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.psr_pid).to.equal('PID_QB')
  })

  it('sportradar interaction: sportradar-written psr_pid is overwritten when play_stats lands a different passer', () => {
    // Sportradar wrote {psr_gsis: GSIS_SR, psr_pid: PID_SR} before play_stats
    // imported. play_stats arrives with a different passer (statId 14).
    // Owned writer overwrites both columns without --overwrite-existing.
    const play_row = {
      esbid,
      playId,
      psr_gsis: 'GSIS_SR',
      psr_pid: 'PID_SR'
    }
    const stats = [
      play_stat({ esbid, playId, statId: 14, gsisId: 'GSIS_REAL' })
    ]
    const cache = make_player_cache({
      GSIS_SR: 'PID_SR',
      GSIS_REAL: 'PID_REAL'
    })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.psr_gsis).to.equal('GSIS_REAL')
    expect(enriched.psr_pid).to.equal('PID_REAL')
  })

  it('penalty family remains on legacy OR-fallback path (unchanged)', () => {
    // Penalty has no play_stats source. Existing play-row penalty_player_gsis
    // is preserved and resolved to a pid via the legacy mapper.
    const play_row = {
      esbid,
      playId,
      penalty_player_gsis: 'GSIS_PEN'
    }
    const stats = [play_stat({ esbid, playId, statId: 79, gsisId: 'GSIS_T' })]
    const cache = make_player_cache({ GSIS_PEN: 'PID_PEN', GSIS_T: 'PID_T' })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    // Penalty pid resolved from existing play-row gsis -- not cleared.
    expect(enriched.penalty_player_gsis).to.equal('GSIS_PEN')
    expect(enriched.penalty_player_pid).to.equal('PID_PEN')
  })

  it('live-game window: zero play_stats leaves single-player columns untouched', () => {
    const play_row = {
      esbid,
      playId,
      bc_gsis: 'GSIS_BC',
      bc_pid: 'PID_BC',
      psr_gsis: 'GSIS_QB',
      psr_pid: 'PID_QB'
    }
    const cache = make_player_cache({ GSIS_BC: 'PID_BC', GSIS_QB: 'PID_QB' })

    const [enriched] = enrich_player_identifications([play_row], [], cache)

    expect(enriched.bc_gsis).to.equal('GSIS_BC')
    expect(enriched.bc_pid).to.equal('PID_BC')
    expect(enriched.psr_gsis).to.equal('GSIS_QB')
    expect(enriched.psr_pid).to.equal('PID_QB')
  })
})

describe('enrich_player_identifications snap-roster fallback (source NULL gsisId)', function () {
  const esbid = 2025110204
  const playId = 1130

  // A role stat row the NFL feed emitted with playerName + clubCode but a NULL
  // gsisId (the Jennings failure mode).
  const named_stat = ({
    statId,
    playerName,
    clubCode = 'NE',
    gsisId = null
  }) => ({
    esbid,
    playId,
    statId,
    gsisId,
    playerName,
    clubCode
  })

  // esbid -> Map(normalized name -> [{ pid, gsisid }])
  const make_roster = (by_name) => {
    const inner = new Map(Object.entries(by_name))
    return new Map([[esbid, inner]])
  }

  it('recovers bc_pid from the snap roster when statId 10 gsisId is NULL', () => {
    const play_row = { esbid, playId }
    const stats = [named_stat({ statId: 10, playerName: 'T.Jennings' })]
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

    expect(enriched.bc_gsis).to.equal('00-0039757')
    expect(enriched.bc_pid).to.equal('TERR-JENN')
  })

  it('abstains when two snap participants share the name (never guesses)', () => {
    const play_row = { esbid, playId }
    const stats = [named_stat({ statId: 10, playerName: 'T.Jennings' })]
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

    expect(enriched.bc_gsis).to.equal(null)
    expect(enriched.bc_pid).to.equal(null)
  })

  it('abstains when the stat-row name is not in the game roster', () => {
    const play_row = { esbid, playId }
    const stats = [named_stat({ statId: 10, playerName: 'T.Jennings' })]
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

    expect(enriched.bc_pid).to.equal(null)
  })

  it('no roster arg: source NULL gsisId stays NULL-cleared (legacy behavior)', () => {
    const play_row = {
      esbid,
      playId,
      bc_gsis: 'GSIS_STALE',
      bc_pid: 'PID_STALE'
    }
    const stats = [named_stat({ statId: 10, playerName: 'T.Jennings' })]
    const cache = make_player_cache({ '00-0039757': 'TERR-JENN' })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.bc_gsis).to.equal(null)
    expect(enriched.bc_pid).to.equal(null)
  })

  it('feed-provided gsisId takes precedence over the fallback', () => {
    const play_row = { esbid, playId }
    // Feed gave the real gsisId; the roster holds a different (wrong) name match.
    // The primary path must win and the fallback must not fire.
    const stats = [
      named_stat({ statId: 10, playerName: 'T.Jennings', gsisId: '00-0039757' })
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

    expect(enriched.bc_gsis).to.equal('00-0039757')
    expect(enriched.bc_pid).to.equal('TERR-JENN')
  })
})

describe('enrich_player_identifications psr family sack-row attribution', function () {
  const esbid = 1
  const playId = 100

  it('statId 20 alone (sack row, 2023+ feed shape) attributes psr to the QB', () => {
    // 2023+ upstream feed: sack rows omit statIds 14/15/16. statId 20 (Pass
    // Sack) is charged to the QB. statIds 110/120 name the sacker, not the QB.
    const play_row = { esbid, playId, sk: true }
    const stats = [
      play_stat({ esbid, playId, statId: 20, gsisId: 'GSIS_QB' }),
      play_stat({ esbid, playId, statId: 79, gsisId: 'GSIS_SACKER' }),
      play_stat({ esbid, playId, statId: 110, gsisId: 'GSIS_SACKER' }),
      play_stat({ esbid, playId, statId: 120, gsisId: 'GSIS_SACKER' })
    ]
    const cache = make_player_cache({
      GSIS_QB: 'PID_QB',
      GSIS_SACKER: 'PID_SACKER'
    })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.psr_gsis).to.equal('GSIS_QB')
    expect(enriched.psr_pid).to.equal('PID_QB')
  })

  it('normal pass completion (statIds 14/15/16) still resolves psr correctly', () => {
    // Regression guard: legacy non-sack pass-completion shape unaffected.
    const play_row = { esbid, playId }
    const stats = [
      play_stat({ esbid, playId, statId: 15, gsisId: 'GSIS_QB' }),
      play_stat({ esbid, playId, statId: 16, gsisId: 'GSIS_QB' }),
      play_stat({ esbid, playId, statId: 21, gsisId: 'GSIS_WR' })
    ]
    const cache = make_player_cache({ GSIS_QB: 'PID_QB', GSIS_WR: 'PID_WR' })

    const [enriched] = enrich_player_identifications([play_row], stats, cache)

    expect(enriched.psr_gsis).to.equal('GSIS_QB')
    expect(enriched.psr_pid).to.equal('PID_QB')
  })
})

describe('compute_play_changes defensive: lhs undefined on clearable prop', function () {
  it('rhs null with lhs undefined (Knex never-set column) is a no-op', () => {
    // deep-diff emits kind:N for new keys with rhs:null when lhs is
    // undefined. compute_play_changes filters to kind:E only, so this is
    // silently dropped -- which is the correct behavior because there's
    // no prior value to clear.
    const { changes_count, field_updates } = compute_play_changes({
      play_row: { esbid: 1, playId: 100 },
      update: { solo_tackle_1_pid: null },
      clearable_fields: new Set(['solo_tackle_1_pid'])
    })

    expect(changes_count).to.equal(0)
    expect(field_updates).to.deep.equal({})
  })
})

describe('yardage-stat-enrichment _gsis emission contract', function () {
  it('emits no _gsis fields after Phase B Task 11 migration', async () => {
    const { enrich_yardage_stats } = await import(
      '#libs-server/play-enrichment/yardage-stat-enrichment.mjs'
    )
    const esbid = 1
    const playId = 100
    // statId 11 is rushing yards (bc). Pre-Task-11 this would have emitted bc_gsis.
    const stat = play_stat({ esbid, playId, statId: 11, gsisId: 'GSIS_BC' })
    stat.yards = 5

    const [enriched] = enrich_yardage_stats([{ esbid, playId }], [stat])

    expect(enriched).to.not.have.property('bc_gsis')
    expect(enriched).to.not.have.property('psr_gsis')
    expect(enriched).to.not.have.property('trg_gsis')
    expect(enriched).to.not.have.property('intp_gsis')
    expect(enriched).to.not.have.property('player_fuml_gsis')
  })
})
