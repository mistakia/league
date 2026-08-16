/* global describe it */
import * as chai from 'chai'

import { classify_drive_seq_coherence } from '../scripts/audit-drive-seq-coherence.mjs'

const expect = chai.expect

// A drive_seq value spanning both halves makes the `${esbid}_${drive_seq}`
// drive key address two drives at once. The auditor's whole job is telling
// that apart from the boundary artifact NFL's feed produces, where an
// administrative END QUARTER 2 marker carries the sequence of the drive that
// is about to start -- a half-1 row holding a half-2 drive number, with no
// real drive merged.
//
// Both shapes present identically to a check that counts distinct
// (esbid, drive_seq) against distinct (esbid, half, drive_seq) over every row,
// which is why this fixture pins them as a PAIR. Asserting only that the real
// merge is caught passes just as well on a check that flags everything.

const scrimmage_play = ({ esbid, quarter, drive_seq, play_type = 'RUSH' }) => ({
  esbid,
  quarter,
  drive_seq,
  play_type,
  play_type_nfl: play_type === 'RUSH' ? 'RUSH' : 'PASS',
  is_passing_play: play_type === 'PASS',
  is_rushing_play: play_type === 'RUSH'
})

const end_of_quarter_marker = ({ esbid, quarter, drive_seq }) => ({
  esbid,
  quarter,
  drive_seq,
  play_type: 'NOPL',
  play_type_nfl: 'END_QUARTER',
  is_passing_play: null,
  is_rushing_play: null
})

// A coherent game: drive_seq runs 1..4 game-continuous, halftime between 2
// and 3, and no value appears in both halves.
const coherent_game = (esbid) => [
  scrimmage_play({ esbid, quarter: 1, drive_seq: 1 }),
  scrimmage_play({ esbid, quarter: 2, drive_seq: 2 }),
  scrimmage_play({ esbid, quarter: 3, drive_seq: 3 }),
  scrimmage_play({ esbid, quarter: 4, drive_seq: 4 })
]

describe('audit drive_seq coherence', function () {
  it('reports no violation for a game whose drive_seq never spans halftime', () => {
    const result = classify_drive_seq_coherence(coherent_game(2026010101))

    expect(result.games_checked).to.equal(1)
    expect(result.violations).to.have.lengthOf(0)
    expect(result.violation_counts_by_class).to.deep.equal({
      restart_at_1: 0,
      other: 0
    })
  })

  it('flags a real cross-half merge, where both halves carry a scrimmage play under one drive_seq', () => {
    // 2014110209's shape: a half-1 drive whose number is also worn by a
    // stray half-2 play.
    const rows = [
      scrimmage_play({ esbid: 2026010102, quarter: 1, drive_seq: 1 }),
      scrimmage_play({ esbid: 2026010102, quarter: 2, drive_seq: 2 }),
      scrimmage_play({ esbid: 2026010102, quarter: 3, drive_seq: 2 }),
      scrimmage_play({ esbid: 2026010102, quarter: 4, drive_seq: 3 })
    ]

    const result = classify_drive_seq_coherence(rows)

    expect(result.violations).to.have.lengthOf(1)
    expect(result.violations[0].esbid).to.equal(2026010102)
    expect(result.violations[0].violation_class).to.equal('other')
    expect(result.violation_counts_by_class.other).to.equal(1)
  })

  it('does NOT flag an END QUARTER 2 marker carrying the next half drive number', () => {
    // The 2026 preseason shape, and the false positive this check emitted on
    // eight games: the only half-1 member of drive_seq 3 is the clock marker.
    const rows = [
      scrimmage_play({ esbid: 2026010103, quarter: 1, drive_seq: 1 }),
      scrimmage_play({ esbid: 2026010103, quarter: 2, drive_seq: 2 }),
      end_of_quarter_marker({ esbid: 2026010103, quarter: 2, drive_seq: 3 }),
      scrimmage_play({ esbid: 2026010103, quarter: 3, drive_seq: 3 }),
      scrimmage_play({ esbid: 2026010103, quarter: 4, drive_seq: 4 })
    ]

    const result = classify_drive_seq_coherence(rows)

    expect(result.games_checked).to.equal(1)
    expect(result.violations).to.have.lengthOf(0)
  })

  it('still flags a merge that an administrative marker sits alongside', () => {
    // The marker must not launder a genuine merge: drive_seq 2 holds a real
    // play in each half AND an end-of-quarter marker.
    const rows = [
      scrimmage_play({ esbid: 2026010104, quarter: 1, drive_seq: 1 }),
      scrimmage_play({ esbid: 2026010104, quarter: 2, drive_seq: 2 }),
      end_of_quarter_marker({ esbid: 2026010104, quarter: 2, drive_seq: 2 }),
      scrimmage_play({ esbid: 2026010104, quarter: 3, drive_seq: 2 })
    ]

    const result = classify_drive_seq_coherence(rows)

    expect(result.violations).to.have.lengthOf(1)
    expect(result.violations[0].esbid).to.equal(2026010104)
  })

  it('classifies a per-half counter reset as restart_at_1, apart from other', () => {
    const rows = [
      scrimmage_play({ esbid: 2026010105, quarter: 1, drive_seq: 1 }),
      scrimmage_play({ esbid: 2026010105, quarter: 2, drive_seq: 2 }),
      scrimmage_play({ esbid: 2026010105, quarter: 3, drive_seq: 1 }),
      scrimmage_play({ esbid: 2026010105, quarter: 4, drive_seq: 2 })
    ]

    const result = classify_drive_seq_coherence(rows)

    expect(result.violation_counts_by_class).to.deep.equal({
      restart_at_1: 1,
      other: 0
    })
  })

  it('keeps a mislabeled administrative row that records a real pass or rush', () => {
    // The feed carries a handful of END_QUARTER rows that are actually plays.
    // Those are drive members, so a cross-half one is a genuine merge.
    const rows = [
      scrimmage_play({ esbid: 2026010106, quarter: 1, drive_seq: 1 }),
      scrimmage_play({ esbid: 2026010106, quarter: 2, drive_seq: 2 }),
      {
        ...end_of_quarter_marker({
          esbid: 2026010106,
          quarter: 2,
          drive_seq: 3
        }),
        play_type: 'PASS',
        is_passing_play: true
      },
      scrimmage_play({ esbid: 2026010106, quarter: 3, drive_seq: 3 })
    ]

    const result = classify_drive_seq_coherence(rows)

    expect(result.violations).to.have.lengthOf(1)
  })

  it('counts overtime into the second half rather than a bucket of its own', () => {
    const rows = [
      scrimmage_play({ esbid: 2026010107, quarter: 1, drive_seq: 1 }),
      scrimmage_play({ esbid: 2026010107, quarter: 4, drive_seq: 2 }),
      scrimmage_play({ esbid: 2026010107, quarter: 5, drive_seq: 2 })
    ]

    // Same drive_seq in Q4 and OT is one half, so no violation.
    const result = classify_drive_seq_coherence(rows)

    expect(result.violations).to.have.lengthOf(0)
  })

  it('grades every game in the batch independently', () => {
    const rows = [
      ...coherent_game(2026010108),
      scrimmage_play({ esbid: 2026010109, quarter: 2, drive_seq: 5 }),
      scrimmage_play({ esbid: 2026010109, quarter: 3, drive_seq: 5 })
    ]

    const result = classify_drive_seq_coherence(rows)

    expect(result.games_checked).to.equal(2)
    expect(result.violations).to.have.lengthOf(1)
    expect(result.violations[0].esbid).to.equal(2026010109)
  })
})
