/* global describe it beforeEach afterEach */
import * as chai from 'chai'

import { setupLocalStorageMock } from '../mocks/localStorage.mjs'
import {
  data_view_browser_storage_save_snapshot,
  data_view_browser_storage_load_view_history,
  data_view_browser_storage_get_latest_snapshot,
  data_view_browser_storage_cleanup_old_views,
  data_view_browser_storage_clear_view_history,
  data_view_browser_storage_set_last_active_view,
  data_view_browser_storage_get_last_active_view
} from '@core/data-views/browser-storage.mjs'

const { expect } = chai

describe('Data Views Browser Storage', function () {
  let mockStorage

  beforeEach(() => {
    mockStorage = setupLocalStorageMock()
  })

  afterEach(() => {
    mockStorage.clear()
  })

  describe('data_view_browser_storage_save_snapshot', () => {
    it('should save a snapshot to localStorage', async () => {
      const view_id = 'test-view-123'
      const table_state = { columns: ['name', 'age'], filters: [] }

      await data_view_browser_storage_save_snapshot({
        view_id,
        table_state,
        change_type: 'user_edit'
      })

      const stored_data = JSON.parse(
        mockStorage.getItem(`data_view_history_${view_id}`)
      )
      expect(stored_data).to.be.an('array')
      expect(stored_data).to.have.lengthOf(1)
      expect(stored_data[0]).to.have.property('table_state')
      expect(stored_data[0].table_state).to.deep.equal(table_state)
      expect(stored_data[0]).to.have.property('change_type', 'user_edit')
      expect(stored_data[0]).to.have.property('timestamp')
    })

    it('should append multiple snapshots to history', async () => {
      const view_id = 'test-view-123'
      const state1 = { columns: ['name'] }
      const state2 = { columns: ['name', 'age'] }

      await data_view_browser_storage_save_snapshot({
        view_id,
        table_state: state1,
        change_type: 'user_edit'
      })

      await data_view_browser_storage_save_snapshot({
        view_id,
        table_state: state2,
        change_type: 'user_edit'
      })

      const history = await data_view_browser_storage_load_view_history(view_id)
      expect(history).to.have.lengthOf(2)
      expect(history[0].table_state).to.deep.equal(state1)
      expect(history[1].table_state).to.deep.equal(state2)
    })

    it('should trim history to max 20 snapshots (FIFO)', async () => {
      const view_id = 'test-view-123'

      // Add 25 snapshots
      for (let i = 0; i < 25; i++) {
        await data_view_browser_storage_save_snapshot({
          view_id,
          table_state: { iteration: i },
          change_type: 'user_edit'
        })
      }

      const history = await data_view_browser_storage_load_view_history(view_id)

      expect(history).to.have.lengthOf(20)
      // Should keep the latest 20 (iterations 5-24)
      expect(history[0].table_state.iteration).to.equal(5)
      expect(history[19].table_state.iteration).to.equal(24)
    })

    it('should update metadata with view access time', async () => {
      const view_id = 'test-view-123'
      const table_state = { columns: [] }

      await data_view_browser_storage_save_snapshot({
        view_id,
        table_state,
        change_type: 'user_edit'
      })

      const metadata = JSON.parse(mockStorage.getItem('data_view_metadata'))
      expect(metadata).to.have.property('view_access_times')
      expect(metadata.view_access_times).to.have.property(view_id)
      expect(metadata.view_access_times[view_id]).to.be.a('number')
    })
  })

  describe('data_view_browser_storage_load_view_history', () => {
    it('should load existing history', async () => {
      const view_id = 'test-view-123'
      const history = [
        {
          table_state: { columns: [] },
          timestamp: Date.now(),
          change_type: 'user_edit'
        }
      ]

      mockStorage.setItem(
        `data_view_history_${view_id}`,
        JSON.stringify(history)
      )

      const loaded = await data_view_browser_storage_load_view_history(view_id)
      expect(loaded).to.deep.equal(history)
    })

    it('should return empty array if no history exists', async () => {
      const loaded =
        await data_view_browser_storage_load_view_history('non-existent-view')
      expect(loaded).to.be.an('array')
      expect(loaded).to.have.lengthOf(0)
    })

    it('should handle corrupted JSON gracefully', async () => {
      const view_id = 'test-view-123'
      mockStorage.setItem(`data_view_history_${view_id}`, 'invalid json {')

      const loaded = await data_view_browser_storage_load_view_history(view_id)
      expect(loaded).to.be.an('array')
      expect(loaded).to.have.lengthOf(0)
    })
  })

  describe('data_view_browser_storage_get_latest_snapshot', () => {
    it('should return most recent snapshot', async () => {
      const view_id = 'test-view-123'
      const state1 = { columns: ['name'] }
      const state2 = { columns: ['name', 'age'] }

      await data_view_browser_storage_save_snapshot({
        view_id,
        table_state: state1,
        change_type: 'user_edit'
      })

      await data_view_browser_storage_save_snapshot({
        view_id,
        table_state: state2,
        change_type: 'user_edit'
      })

      const latest =
        await data_view_browser_storage_get_latest_snapshot(view_id)
      expect(latest).to.have.property('table_state')
      expect(latest.table_state).to.deep.equal(state2)
    })

    it('should return null if no history exists', async () => {
      const latest =
        await data_view_browser_storage_get_latest_snapshot('non-existent-view')
      expect(latest).to.be.null
    })
  })

  describe('data_view_browser_storage_cleanup_old_views', () => {
    it('should remove oldest views when exceeding max limit', async () => {
      // Create 55 views (max is 50)
      for (let i = 0; i < 55; i++) {
        const view_id = `view-${i}`
        await data_view_browser_storage_save_snapshot({
          view_id,
          table_state: { id: i },
          change_type: 'user_edit'
        })
        // Ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 5))
      }

      // Run cleanup
      await data_view_browser_storage_cleanup_old_views()

      // Check metadata - should have only 50 views
      const metadata = JSON.parse(mockStorage.getItem('data_view_metadata'))
      const view_count = Object.keys(metadata.view_access_times).length
      expect(view_count).to.equal(50)

      // Oldest 5 views should be removed (view-0 through view-4)
      for (let i = 0; i < 5; i++) {
        const view_id = `view-${i}`
        const history =
          await data_view_browser_storage_load_view_history(view_id)
        expect(history).to.have.lengthOf(0)
      }

      // Newest 50 views should still exist (view-5 through view-54)
      for (let i = 5; i < 55; i++) {
        const view_id = `view-${i}`
        const history =
          await data_view_browser_storage_load_view_history(view_id)
        expect(history).to.have.lengthOf(1)
      }
    })

    it('should not remove views if under limit', async () => {
      // Create only 10 views (well under 50 limit)
      for (let i = 0; i < 10; i++) {
        await data_view_browser_storage_save_snapshot({
          view_id: `view-${i}`,
          table_state: { id: i },
          change_type: 'user_edit'
        })
      }

      await data_view_browser_storage_cleanup_old_views()

      // All 10 should still exist
      for (let i = 0; i < 10; i++) {
        const history = await data_view_browser_storage_load_view_history(
          `view-${i}`
        )
        expect(history).to.have.lengthOf(1)
      }
    })

    it('should update cleanup timestamp in metadata', async () => {
      await data_view_browser_storage_cleanup_old_views()

      const metadata = JSON.parse(mockStorage.getItem('data_view_metadata'))
      expect(metadata).to.have.property('last_cleanup')
      expect(metadata.last_cleanup).to.be.a('number')
    })
  })

  describe('data_view_browser_storage_clear_view_history', () => {
    it('should remove view history from localStorage', async () => {
      const view_id = 'test-view-123'

      await data_view_browser_storage_save_snapshot({
        view_id,
        table_state: { columns: [] },
        change_type: 'user_edit'
      })

      // Verify it exists
      let history = await data_view_browser_storage_load_view_history(view_id)
      expect(history).to.have.lengthOf(1)

      // Clear it
      await data_view_browser_storage_clear_view_history(view_id)

      // Verify it's gone
      history = await data_view_browser_storage_load_view_history(view_id)
      expect(history).to.have.lengthOf(0)
    })

    it('should remove view from metadata', async () => {
      const view_id = 'test-view-123'

      await data_view_browser_storage_save_snapshot({
        view_id,
        table_state: { columns: [] },
        change_type: 'user_edit'
      })

      // Verify in metadata
      let metadata = JSON.parse(mockStorage.getItem('data_view_metadata'))
      expect(metadata.view_access_times).to.have.property(view_id)

      // Clear it
      await data_view_browser_storage_clear_view_history(view_id)

      // Verify removed from metadata
      metadata = JSON.parse(mockStorage.getItem('data_view_metadata'))
      expect(metadata.view_access_times).to.not.have.property(view_id)
    })
  })

  describe('data_view_browser_storage_set_last_active_view', () => {
    it('should save last active view ID and timestamp', async () => {
      const view_id = 'test-view-123'

      await data_view_browser_storage_set_last_active_view(view_id)

      const last_active = JSON.parse(
        mockStorage.getItem('data_view_last_active')
      )
      expect(last_active).to.have.property('view_id', view_id)
      expect(last_active).to.have.property('timestamp')
      expect(last_active.timestamp).to.be.a('number')
    })
  })

  describe('data_view_browser_storage_get_last_active_view', () => {
    it('should retrieve last active view', async () => {
      const view_id = 'test-view-123'

      await data_view_browser_storage_set_last_active_view(view_id)

      const last_active = await data_view_browser_storage_get_last_active_view()
      expect(last_active).to.have.property('view_id', view_id)
      expect(last_active).to.have.property('timestamp')
    })

    it('should return null if no last active view exists', async () => {
      const last_active = await data_view_browser_storage_get_last_active_view()
      expect(last_active).to.be.null
    })
  })

  describe('Integration: Full save/restore flow', () => {
    it('should persist and restore complete view state', async () => {
      const view_id = 'integration-test-view'
      const original_state = {
        columns: ['player_name', 'position', 'points'],
        filters: [{ field: 'position', operator: '=', value: 'QB' }],
        sort: [{ field: 'points', direction: 'desc' }],
        page_size: 50,
        page: 1
      }

      // Save state
      await data_view_browser_storage_save_snapshot({
        view_id,
        table_state: original_state,
        change_type: 'user_edit'
      })

      // Set as last active
      await data_view_browser_storage_set_last_active_view(view_id)

      // Simulate page reload - retrieve last active view
      const last_active = await data_view_browser_storage_get_last_active_view()
      expect(last_active.view_id).to.equal(view_id)

      // Restore state
      const snapshot = await data_view_browser_storage_get_latest_snapshot(
        last_active.view_id
      )
      expect(snapshot.table_state).to.deep.equal(original_state)
      expect(snapshot.change_type).to.equal('user_edit')
    })

    it('should track multiple edits with history', async () => {
      const view_id = 'edit-history-view'
      const states = [
        { columns: ['name'] },
        { columns: ['name', 'age'] },
        { columns: ['name', 'age', 'position'] }
      ]

      // Simulate multiple user edits
      for (const state of states) {
        await data_view_browser_storage_save_snapshot({
          view_id,
          table_state: state,
          change_type: 'user_edit'
        })
      }

      // Verify full history
      const history = await data_view_browser_storage_load_view_history(view_id)
      expect(history).to.have.lengthOf(3)

      // Verify latest is correct
      const latest =
        await data_view_browser_storage_get_latest_snapshot(view_id)
      expect(latest.table_state).to.deep.equal(states[2])
    })

    it('should mark server saves differently in history', async () => {
      const view_id = 'server-save-view'

      // User edits
      await data_view_browser_storage_save_snapshot({
        view_id,
        table_state: { columns: ['name'] },
        change_type: 'user_edit'
      })

      // Server save
      await data_view_browser_storage_save_snapshot({
        view_id,
        table_state: { columns: ['name', 'saved'] },
        change_type: 'server_save'
      })

      const history = await data_view_browser_storage_load_view_history(view_id)
      expect(history[0].change_type).to.equal('user_edit')
      expect(history[1].change_type).to.equal('server_save')
    })
  })
})
