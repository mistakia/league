/* global describe it */
import * as chai from 'chai'

import { merge_columns_on_conflict } from '#libs-server/merge-columns-on-conflict.mjs'
import { GAMELOG_COLUMNS_NOT_MERGED } from '#scripts/generate-player-gamelogs.mjs'

const expect = chai.expect

describe('LIBS-SERVER /merge-columns-on-conflict', function () {
  it('merges every column the batch names', () => {
    const columns = merge_columns_on_conflict({
      batch: [{ pid: 'A', esbid: 1, rushing_yards: 10 }]
    })
    expect(columns).to.have.members(['pid', 'esbid', 'rushing_yards'])
  })

  it('unions the columns across a ragged batch', () => {
    const columns = merge_columns_on_conflict({
      batch: [
        { pid: 'A', rushing_yards: 10 },
        { pid: 'B', receiving_yards: 4 }
      ]
    })
    expect(columns).to.have.members(['pid', 'rushing_yards', 'receiving_yards'])
  })

  it('holds back exactly the excluded columns', () => {
    const columns = merge_columns_on_conflict({
      batch: [{ pid: 'A', active: true, pos: 'LB', targets: 3 }],
      exclude: ['active', 'pos']
    })
    expect(columns).to.have.members(['pid', 'targets'])
  })

  it('ignores an excluded column the batch never names', () => {
    const columns = merge_columns_on_conflict({
      batch: [{ pid: 'A', targets: 3 }],
      exclude: ['active', 'pos']
    })
    expect(columns).to.have.members(['pid', 'targets'])
  })

  // `active` is owned by import-nflverse-weekly-rosters.mjs; merging it reverted
  // every game-day-inactive flag for any player a gamelog run touched. `pos`
  // was held back alongside it while the position vocabulary was uncontrolled;
  // it is canonical and CHECK-constrained now, so merging it is a no-op rather
  // than a respelling.
  it('keeps the gamelog generator holding back active', () => {
    expect(GAMELOG_COLUMNS_NOT_MERGED).to.have.members(['active'])
  })
})
