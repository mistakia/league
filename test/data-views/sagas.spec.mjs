/* global describe it beforeEach afterEach */
import * as chai from 'chai'

import { setupLocalStorageMock } from '#test/mocks/localStorage.mjs'
import {
  save_snapshot,
  MAX_SNAPSHOTS_PER_VIEW
} from '#libs-shared/data-view-storage/storage.mjs'
import { STORAGE_SCHEMA_VERSION } from '#libs-shared/data-view-storage/migrations.mjs'

const { expect } = chai

// Saga-adjacent tests. These exercise behavior at the storage-module level
// where the saga contract lives (reconcile_server_views inputs, server_save
// change_type, restore-dispatch suppression via deep equality). Full
// generator iteration is not worth the setup cost for behavior that is
// exhaustively tested in storage.spec.mjs.

const make_state = (overrides = {}) => ({
  columns: ['c'],
  prefix_columns: ['player_name'],
  sort: [],
  where: [],
  ...overrides
})

describe('data-views saga integration contracts', () => {
  let mockStorage
  beforeEach(() => {
    mockStorage = setupLocalStorageMock()
  })
  afterEach(() => mockStorage.clear())

  describe('mark_server_save_in_history contract', () => {
    it('writes a snapshot with change_type server_save and is_new_view false', () => {
      const ok = save_snapshot({
        view_id: 'v-srv',
        table_state: make_state(),
        change_type: 'server_save',
        is_new_view: false
      })
      expect(ok).to.be.true
      const history = JSON.parse(mockStorage.getItem('data_view_history_v-srv'))
      expect(history).to.have.lengthOf(1)
      expect(history[0].change_type).to.equal('server_save')
      expect(history[0].version).to.equal(STORAGE_SCHEMA_VERSION)
    })
  })

  describe('restore_view_states_from_browser dispatch suppression', () => {
    it('equivalent plain-JS table_states compare equal for dispatch suppression', async () => {
      const { default: deep_equal } = await import(
        '../../app/core/utils/deep_equal.js'
      )
      const a = make_state({ sort: [{ column_id: 'x', desc: true }] })
      const b = make_state({ sort: [{ column_id: 'x', desc: true }] })
      expect(deep_equal(a, b)).to.be.true
      const c = make_state({ sort: [{ column_id: 'y', desc: true }] })
      expect(deep_equal(a, c)).to.be.false
    })
  })

  describe('reconcile_server_views preserves client-only views', () => {
    it('a view id present in redux but absent from server is not evicted', async () => {
      const { reconcile_server_views } = await import(
        '#libs-shared/data-view-storage/storage.mjs'
      )
      save_snapshot({
        view_id: 'client-only',
        table_state: make_state(),
        change_type: 'user_edit',
        is_new_view: false
      })
      reconcile_server_views({
        server_view_ids: [],
        redux_view_ids: ['client-only']
      })
      expect(mockStorage.getItem('data_view_history_client-only')).to.not.be.null
    })

    it('a view id absent from both server and redux is evicted', async () => {
      const { reconcile_server_views } = await import(
        '#libs-shared/data-view-storage/storage.mjs'
      )
      save_snapshot({
        view_id: 'orphan',
        table_state: make_state(),
        change_type: 'user_edit',
        is_new_view: false
      })
      reconcile_server_views({ server_view_ids: [], redux_view_ids: [] })
      expect(mockStorage.getItem('data_view_history_orphan')).to.be.null
    })
  })

  describe('debounce watcher retains one snapshot per burst', () => {
    it('save_snapshot is callable repeatedly without collapsing history', () => {
      // The debounce is enforced in the saga watcher registration, not the
      // storage module. This ensures that when the debounce fires, the write
      // appends (not collapses) the latest snapshot.
      for (let i = 0; i < 3; i++) {
        save_snapshot({
          view_id: 'v1',
          table_state: make_state({ iteration: i }),
          change_type: 'user_edit',
          is_new_view: false
        })
      }
      const history = JSON.parse(mockStorage.getItem('data_view_history_v1'))
      expect(history).to.have.lengthOf(3)
      expect(history.length).to.be.lessThan(MAX_SNAPSHOTS_PER_VIEW + 1)
    })
  })
})
