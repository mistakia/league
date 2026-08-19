/* global describe it beforeEach afterEach */
import * as chai from 'chai'

import { setupLocalStorageMock } from '#test/mocks/localStorage.mjs'
import {
  plays_view_browser_storage_save_snapshot,
  plays_view_browser_storage_get_latest_snapshot
} from '#app/core/plays-view/browser-storage.mjs'

const { expect } = chai

// get-plays-view-results.mjs resolves play-filter params through the same
// apply_play_by_play_column_params_to_query registry as the from-plays
// data-view columns, and that resolver silently drops any key it does not
// recognise -- so a param renamed in nfl-plays-column-params.mjs orphans a
// saved plays view's filter with no error. user_data_views has a read-time
// migration for exactly this (libs-shared/data-views-saved-view-migration.mjs,
// reached from libs-shared/data-view-storage/migrations.mjs); this pins that
// plays views now get the equivalent through their own browser-storage undo
// history, the only place a plays view's table_state is read back into redux.
describe('plays-view browser storage applies the saved-view param migration', function () {
  let mockStorage

  beforeEach(() => {
    mockStorage = setupLocalStorageMock()
  })

  afterEach(() => {
    mockStorage.clear()
  })

  it('rewrites a legacy shorthand param key on read and persists the rewrite', async function () {
    const view_id = 'migration-test-view'

    await plays_view_browser_storage_save_snapshot({
      view_id,
      table_state: {
        columns: ['team_pass_attempts_from_plays'],
        prefix_columns: [],
        sort: [],
        where: [
          {
            column_id: 'team_pass_attempts_from_plays',
            // qtr is a legacy shorthand param key renamed to `quarter` by the
            // 2026-08-04 shorthand conform (SHORTHAND_PARAM_RENAMES).
            params: { qtr: [1, 2] }
          }
        ]
      },
      change_type: 'user_edit'
    })

    const snapshot =
      await plays_view_browser_storage_get_latest_snapshot(view_id)

    expect(snapshot.table_state.where[0].params).to.deep.equal({
      quarter: [1, 2]
    })
    expect(snapshot.table_state.where[0].params).to.not.have.property('qtr')

    // The rewrite must be persisted, not just returned once -- a second read
    // (a fresh page load, no further edits) has to see the same migrated key
    // rather than re-deriving it from the still-legacy stored copy.
    const second_read =
      await plays_view_browser_storage_get_latest_snapshot(view_id)
    expect(second_read.table_state.where[0].params).to.deep.equal({
      quarter: [1, 2]
    })
  })

  it('is a no-op for a snapshot with no legacy keys', async function () {
    const view_id = 'migration-test-view-clean'

    await plays_view_browser_storage_save_snapshot({
      view_id,
      table_state: {
        columns: ['team_pass_attempts_from_plays'],
        prefix_columns: [],
        sort: [],
        where: [
          {
            column_id: 'team_pass_attempts_from_plays',
            params: { quarter: [1, 2] }
          }
        ]
      },
      change_type: 'user_edit'
    })

    const snapshot =
      await plays_view_browser_storage_get_latest_snapshot(view_id)

    expect(snapshot.table_state.where[0].params).to.deep.equal({
      quarter: [1, 2]
    })
  })
})
