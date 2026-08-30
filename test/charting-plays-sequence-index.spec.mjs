/* global describe, it */
import * as chai from 'chai'

import {
  build_sequence_index,
  find_play_by_sequence
} from '#scripts/import-plays-charting.mjs'
import grade_plays_import_run from '#libs-server/charting-data/grade-plays-import-run.mjs'

const expect = chai.expect

// nfl_plays.sequence is numeric(10,1), and node-postgres returns numeric as a
// STRING to avoid float precision loss -- so a real cached play carries
// sequence: '888.0', not 888. The vendor sends playSequenceNumber as a plain
// number. A Map keys by identity, so the two never met: measured 0 of 961
// vendor plays matched by sequence across six 2025 regular-season games, and
// 960 of 961 once both sides were coerced.
//
// Every one of those 961 plays fell through to the context matcher instead --
// which, until 1b4133709, was running with quarter and down silently dropped.
// So this defect is what made that one reachable on every play rather than on a
// bounded fallback.
//
// The string form is the case that matters. An index built from plain numbers
// passes whatever the lookup does, which is exactly why a spec written from the
// vendor's side alone would have certified the broken code.
describe('SCRIPTS charting plays sequence index', function () {
  const play_from_db = { esbid: 2025112000, sequence: '888.0', play_id: 'a' }
  const second_play = { esbid: 2025112000, sequence: '1046.0', play_id: 'b' }

  it('matches a numeric-string sequence against the vendor number', function () {
    const index = build_sequence_index([play_from_db, second_play])

    expect(find_play_by_sequence(index, 888)).to.equal(play_from_db)
    expect(find_play_by_sequence(index, 1046)).to.equal(second_play)
  })

  it('is not fooled by a raw Map lookup, which is the defect', function () {
    // The control: the shape the code used to have. If this ever starts
    // passing, the driver changed its numeric handling and the comment above
    // needs re-measuring rather than the spec deleting.
    const naive = new Map()
    for (const play of [play_from_db, second_play]) {
      naive.set(play.sequence, play)
    }
    expect(naive.get(888)).to.equal(undefined)
  })

  it('matches when the sequence arrives as a number on both sides', function () {
    const index = build_sequence_index([{ sequence: 42, play_id: 'c' }])
    expect(find_play_by_sequence(index, 42).play_id).to.equal('c')
  })

  it('returns null rather than a wrong play for a miss', function () {
    const index = build_sequence_index([play_from_db])

    expect(find_play_by_sequence(index, 999)).to.equal(null)
    expect(find_play_by_sequence(index, null)).to.equal(null)
    expect(find_play_by_sequence(index, undefined)).to.equal(null)
    expect(find_play_by_sequence(index, 'not a number')).to.equal(null)
  })

  it('skips a play with no sequence instead of keying it under NaN', function () {
    const index = build_sequence_index([
      play_from_db,
      { sequence: null, play_id: 'x' },
      { play_id: 'y' }
    ])
    expect(index.size).to.equal(1)
  })
})

// The oracle added when this import was first scheduled. Its match-rate floor
// is set from the two measured states of the sequence lookup -- roughly 54
// percent while it was broken, 99.9 percent once fixed -- so the case that
// matters is that the broken state FAILS. An oracle that passed both would have
// let the defect through its first scheduled run, which is exactly what
// happened for four months with no oracle at all.
describe('LIBS-SERVER charting plays import oracle', function () {
  const healthy = {
    games_selected: 16,
    games_processed: 16,
    games_failed: 0,
    games_empty: 0,
    total_plays_matched: 2560,
    total_plays_unmatched: 3,
    total_fields_updated: 30000
  }

  it('passes a healthy run', function () {
    expect(grade_plays_import_run(healthy).passed).to.equal(true)
  })

  it('fails the match rate the broken sequence lookup produced', function () {
    const grade = grade_plays_import_run({
      ...healthy,
      total_plays_matched: 517,
      total_plays_unmatched: 444
    })
    expect(grade.passed).to.equal(false)
    expect(grade.summary).to.match(/play match rate/)
  })

  it('fails a scope that selected no games', function () {
    const grade = grade_plays_import_run({
      ...healthy,
      games_selected: 0,
      games_processed: 0,
      total_plays_matched: 0,
      total_plays_unmatched: 0,
      total_fields_updated: 0
    })
    expect(grade.passed).to.equal(false)
    expect(grade.summary).to.match(/selected no games/)
  })

  // The steady state of a weekly cron: everything in scope is already imported,
  // nothing to do, and that must not be an error.
  it('passes when everything in scope is already covered', function () {
    const grade = grade_plays_import_run({
      games_selected: 16,
      games_processed: 0,
      games_failed: 0,
      games_empty: 0,
      total_plays_matched: 0,
      total_plays_unmatched: 0,
      total_fields_updated: 0
    })
    expect(grade.passed).to.equal(true)
  })

  it('names the game failure rate rather than the match rate when games fail', function () {
    const grade = grade_plays_import_run({
      ...healthy,
      games_processed: 8,
      games_failed: 8
    })
    expect(grade.passed).to.equal(false)
    expect(grade.summary).to.match(/game failure rate/)
  })
})
