/* global describe it */
import * as chai from 'chai'

import { calculate_week_all_play_records } from '#libs-shared/calculate-week-all-play-records.mjs'

const expect = chai.expect

describe('LIBS-SHARED calculate_week_all_play_records', function () {
  it('gives a strict ordering the expected all play record per team', () => {
    const records = calculate_week_all_play_records({
      scores_by_team_id: new Map([
        [1, 120.5],
        [2, 99.25],
        [3, 140.0],
        [4, 88.75]
      ])
    })

    expect(records.get(3)).to.deep.equal({
      all_play_wins: 3,
      all_play_losses: 0,
      all_play_ties: 0
    })
    expect(records.get(1)).to.deep.equal({
      all_play_wins: 2,
      all_play_losses: 1,
      all_play_ties: 0
    })
    expect(records.get(2)).to.deep.equal({
      all_play_wins: 1,
      all_play_losses: 2,
      all_play_ties: 0
    })
    expect(records.get(4)).to.deep.equal({
      all_play_wins: 0,
      all_play_losses: 3,
      all_play_ties: 0
    })
  })

  it('splits a three-way tie as a tie for all three', () => {
    const records = calculate_week_all_play_records({
      scores_by_team_id: new Map([
        [1, 100],
        [2, 100],
        [3, 100]
      ])
    })

    for (const tid of [1, 2, 3]) {
      expect(records.get(tid)).to.deep.equal({
        all_play_wins: 0,
        all_play_losses: 0,
        all_play_ties: 2
      })
    }
  })

  it('places a tied run above what it beats and below what beats it', () => {
    const records = calculate_week_all_play_records({
      scores_by_team_id: new Map([
        [1, 150],
        [2, 100],
        [3, 100],
        [4, 50]
      ])
    })

    expect(records.get(2)).to.deep.equal({
      all_play_wins: 1,
      all_play_losses: 1,
      all_play_ties: 1
    })
    expect(records.get(3)).to.deep.equal({
      all_play_wins: 1,
      all_play_losses: 1,
      all_play_ties: 1
    })
  })

  it('gives every team a record summing to the rest of the league', () => {
    const scores_by_team_id = new Map(
      [112, 98, 143, 143, 76, 101, 88, 130, 99, 120].map((score, index) => [
        index + 1,
        score
      ])
    )
    const records = calculate_week_all_play_records({ scores_by_team_id })

    expect(records.size).to.equal(10)
    for (const [, record] of records) {
      expect(
        record.all_play_wins + record.all_play_losses + record.all_play_ties
      ).to.equal(9)
    }
  })

  it('refuses a plain object, whose keys would coerce to strings', () => {
    expect(() =>
      calculate_week_all_play_records({ scores_by_team_id: { 1: 100, 2: 90 } })
    ).to.throw(/requires scores_by_team_id as a Map/)
  })

  it('refuses a non-finite score rather than ranking that team last', () => {
    expect(() =>
      calculate_week_all_play_records({
        scores_by_team_id: new Map([
          [1, 100],
          [2, undefined]
        ])
      })
    ).to.throw(/team 2 has a non-finite week score/)
  })
})
