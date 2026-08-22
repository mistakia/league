/* global describe it */

import * as chai from 'chai'

import db from '#db'
import {
  scrimmage_play_types,
  stat_countable_play_types,
  non_nullified_play_types
} from '#libs-shared/constants/play-type-constants.mjs'
import { apply_play_type_filter } from '#libs-server/data-views/apply-play-type-filter.mjs'

chai.should()
const expect = chai.expect

// The full nfl_plays.play_type enum, spelled out here on purpose. It is the
// only thing that can catch a NEW enum label being silently absent from every
// set -- which would make it non-countable everywhere without anyone deciding
// that. Mirrors NflPlayType in db/schema-types.d.ts.
const all_play_types = [
  'PASS',
  'RUSH',
  'CONV',
  'NOPL',
  'KOFF',
  'PUNT',
  'FGXP',
  'FREE'
]

describe('play-type predicate sets', function () {
  it('every enum label is ruled on by the two countability sets', () => {
    // Neither set may simply omit a label. NOPL is excluded from both and CONV
    // from one; everything else must be present in both.
    for (const play_type of all_play_types) {
      const in_stat = stat_countable_play_types.includes(play_type)
      const in_non_nullified = non_nullified_play_types.includes(play_type)

      if (play_type === 'NOPL') {
        expect(in_stat, 'NOPL is not stat-countable').to.equal(false)
        expect(in_non_nullified, 'NOPL is nullified').to.equal(false)
      } else if (play_type === 'CONV') {
        expect(in_stat, 'CONV is not a standard passing stat').to.equal(false)
        expect(in_non_nullified, 'CONV is not nullified').to.equal(true)
      } else {
        expect(in_stat, `${play_type} is stat-countable`).to.equal(true)
        expect(in_non_nullified, `${play_type} is not nullified`).to.equal(true)
      }
    }
  })

  it('the two countability sets differ in exactly CONV', () => {
    // This is the whole reason there are two of them. Merging them either drops
    // real defensive production on two-point plays or counts a two-point pass
    // as a standard pass attempt.
    const only_in_non_nullified = non_nullified_play_types.filter(
      (play_type) => !stat_countable_play_types.includes(play_type)
    )
    expect(only_in_non_nullified).to.deep.equal(['CONV'])
    expect(
      stat_countable_play_types.filter(
        (play_type) => !non_nullified_play_types.includes(play_type)
      )
    ).to.deep.equal([])
  })

  it('the scrimmage set stays PASS/RUSH and reaches no special teams', () => {
    // Widening this inflates every from-plays rate denominator with the
    // special-teams population and deflates every rate stat, silently.
    expect([...scrimmage_play_types].sort()).to.deep.equal(['PASS', 'RUSH'])
    for (const play_type of ['KOFF', 'PUNT', 'FGXP', 'FREE', 'CONV', 'NOPL']) {
      expect(
        scrimmage_play_types.includes(play_type),
        `${play_type} is not a scrimmage play`
      ).to.equal(false)
    }
  })

  it('kicking and return play types survive both countability sets', () => {
    // Field goals, extra points, kickoff and punt returns are the production a
    // naive single allow-list zeroes. Their play types carry no role pids at
    // all, so nothing else would have caught their removal.
    for (const play_type of ['FGXP', 'KOFF', 'PUNT']) {
      expect(stat_countable_play_types).to.include(play_type)
      expect(non_nullified_play_types).to.include(play_type)
    }
  })
})

describe('apply_play_type_filter', function () {
  const sql_for = (play_type_set, table_name) =>
    apply_play_type_filter({
      query: db('nfl_plays').select('play_id'),
      play_type_set,
      ...(table_name ? { table_name } : {})
    }).toQuery()

  it('emits an IN predicate on play_type for each named set', () => {
    expect(sql_for('stat_countable')).to.include(
      `"nfl_plays"."play_type" in ('PASS', 'RUSH', 'KOFF', 'PUNT', 'FGXP', 'FREE')`
    )
    expect(sql_for('non_nullified')).to.include(`'CONV'`)
    expect(sql_for('scrimmage')).to.include(
      `"nfl_plays"."play_type" in ('PASS', 'RUSH')`
    )
  })

  it('filters play_type, never play_type_nfl or play_type_ngs', () => {
    const sql = sql_for('stat_countable')
    expect(sql).to.not.include('play_type_nfl')
    expect(sql).to.not.include('play_type_ngs')
  })

  it('qualifies the column with the given table name', () => {
    expect(sql_for('non_nullified', 'plays_cte')).to.include(
      `"plays_cte"."play_type" in`
    )
  })

  it('throws on an unknown set name rather than filtering nothing', () => {
    // A predicate that quietly matches everything reads exactly like a clean
    // result, which is the failure direction that looks like success.
    expect(() =>
      apply_play_type_filter({
        query: db('nfl_plays'),
        play_type_set: 'countable'
      })
    ).to.throw(/unknown play_type_set/)
  })
})
