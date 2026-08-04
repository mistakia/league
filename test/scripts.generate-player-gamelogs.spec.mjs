/* global describe it */
import * as chai from 'chai'

import {
  COLUMNS_NOT_MERGED_ON_CONFLICT,
  merge_columns_on_conflict
} from '#scripts/generate-player-gamelogs.mjs'

const expect = chai.expect

describe('SCRIPTS /generate-player-gamelogs', function () {
  describe('merge_columns_on_conflict', function () {
    it('merges every column the batch names', () => {
      const columns = merge_columns_on_conflict([
        { pid: 'A', esbid: 1, rushing_yards: 10 }
      ])
      expect(columns).to.have.members(['pid', 'esbid', 'rushing_yards'])
    })

    it('unions the columns across a ragged batch', () => {
      const columns = merge_columns_on_conflict([
        { pid: 'A', rushing_yards: 10 },
        { pid: 'B', receiving_yards: 4 }
      ])
      expect(columns).to.have.members([
        'pid',
        'rushing_yards',
        'receiving_yards'
      ])
    })

    // `active` is owned by import-nflverse-weekly-rosters.mjs. Merging it
    // reverted every game-day-inactive flag for any player a run touched.
    it('holds back active, which the roster import owns', () => {
      const columns = merge_columns_on_conflict([
        { pid: 'A', active: true, rushing_yards: 10 }
      ])
      expect(columns).to.not.include('active')
      expect(columns).to.include('rushing_yards')
    })

    // `pos` copies player.primary_position, which has no controlled vocabulary,
    // so merging rewrites a stored value to a different spelling of itself.
    it('holds back pos until the position vocabulary is canonical', () => {
      const columns = merge_columns_on_conflict([
        { pid: 'A', pos: 'LB', rushing_yards: 10 }
      ])
      expect(columns).to.not.include('pos')
      expect(columns).to.include('rushing_yards')
    })

    it('holds back exactly the declared set and nothing else', () => {
      const item = { pid: 'A', active: true, pos: 'LB', targets: 3 }
      const columns = merge_columns_on_conflict([item])
      const held_back = Object.keys(item).filter((c) => !columns.includes(c))
      expect(held_back).to.have.members(COLUMNS_NOT_MERGED_ON_CONFLICT)
    })
  })
})
