/* global describe it beforeEach afterEach */
import * as chai from 'chai'

import { setupLocalStorageMock } from '#test/mocks/localStorage.mjs'
import {
  save_snapshot,
  load_latest_snapshot,
  load_history,
  clear_view,
  clear_all,
  reconcile_server_views,
  save_last_active_view,
  load_last_active_view,
  get_all_stored_view_ids,
  init_storage,
  MAX_SNAPSHOTS_PER_VIEW,
  MAX_VIEWS_CACHED
} from '#libs-shared/data-view-storage/storage.mjs'
import { STORAGE_SCHEMA_VERSION } from '#libs-shared/data-view-storage/migrations.mjs'

const { expect } = chai

const make_state = (overrides = {}) => ({
  columns: ['player_name_column'],
  prefix_columns: ['player_name'],
  sort: [],
  where: [],
  ...overrides
})

describe('data-view-storage storage module', function () {
  let mockStorage

  beforeEach(() => {
    mockStorage = setupLocalStorageMock()
    init_storage({ on_quota_exceeded: null })
  })

  afterEach(() => {
    mockStorage.clear()
  })

  describe('save_snapshot', () => {
    it('rejects invalid table_state', () => {
      const ok = save_snapshot({
        view_id: 'v1',
        table_state: { columns: [], prefix_columns: [] },
        change_type: 'user_edit',
        is_new_view: false
      })
      expect(ok).to.be.false
      expect(mockStorage.getItem('data_view_history_v1')).to.be.null
    })

    it('skips default view ids', () => {
      const ok = save_snapshot({
        view_id: 'SEASON_FANTASY_POINTS',
        table_state: make_state(),
        change_type: 'user_edit',
        is_new_view: false
      })
      expect(ok).to.be.false
    })

    it('skips empty-new-view shells', () => {
      const ok = save_snapshot({
        view_id: 'new-view',
        table_state: { columns: [], prefix_columns: ['player_name'] },
        change_type: 'user_edit',
        is_new_view: true
      })
      expect(ok).to.be.false
    })

    it('persists existing saved view edited to zero columns (kept via prefix)', () => {
      const ok = save_snapshot({
        view_id: 'v-existing',
        table_state: { columns: [], prefix_columns: ['player_name'] },
        change_type: 'user_edit',
        is_new_view: false
      })
      expect(ok).to.be.true
      const history = JSON.parse(
        mockStorage.getItem('data_view_history_v-existing')
      )
      expect(history).to.have.lengthOf(1)
      expect(history[0]).to.have.property('version', STORAGE_SCHEMA_VERSION)
    })

    it('stamps version and timestamp', () => {
      save_snapshot({
        view_id: 'v1',
        table_state: make_state(),
        change_type: 'user_edit',
        is_new_view: false
      })
      const history = JSON.parse(mockStorage.getItem('data_view_history_v1'))
      expect(history[0].version).to.equal(STORAGE_SCHEMA_VERSION)
      expect(history[0].timestamp).to.be.a('number')
    })

    it('trims history to MAX_SNAPSHOTS_PER_VIEW', () => {
      for (let i = 0; i < MAX_SNAPSHOTS_PER_VIEW + 5; i++) {
        save_snapshot({
          view_id: 'v1',
          table_state: make_state({ iteration: i }),
          change_type: 'user_edit',
          is_new_view: false
        })
      }
      const history = JSON.parse(mockStorage.getItem('data_view_history_v1'))
      expect(history).to.have.lengthOf(MAX_SNAPSHOTS_PER_VIEW)
    })

    it('updates metadata view_access_times', () => {
      save_snapshot({
        view_id: 'v1',
        table_state: make_state(),
        change_type: 'user_edit',
        is_new_view: false
      })
      const metadata = JSON.parse(mockStorage.getItem('data_view_metadata'))
      expect(metadata.view_access_times).to.have.property('v1')
    })
  })

  describe('load_latest_snapshot', () => {
    it('returns null if no history', () => {
      expect(load_latest_snapshot('missing')).to.be.null
    })

    it('returns the most recent snapshot', () => {
      save_snapshot({
        view_id: 'v1',
        table_state: make_state({ sort: [{ column_id: 'a' }] }),
        change_type: 'user_edit',
        is_new_view: false
      })
      save_snapshot({
        view_id: 'v1',
        table_state: make_state({ sort: [{ column_id: 'b' }] }),
        change_type: 'user_edit',
        is_new_view: false
      })
      const latest = load_latest_snapshot('v1')
      expect(latest.table_state.sort[0].column_id).to.equal('b')
    })

    it('runs migrations on legacy unversioned snapshots and writes back', () => {
      const legacy_history = [
        {
          timestamp: Date.now(),
          change_type: 'user_edit',
          table_state: {
            columns: [
              {
                column_id: 'player_dfs_salary',
                params: { year: [2024], week: [5], seas_type: ['REG'] }
              }
            ],
            prefix_columns: ['player_name'],
            sort: [],
            where: []
          }
        }
      ]
      mockStorage.setItem(
        'data_view_history_v1',
        JSON.stringify(legacy_history)
      )

      const latest = load_latest_snapshot('v1')
      expect(latest.version).to.equal(STORAGE_SCHEMA_VERSION)
      expect(
        latest.table_state.columns[0].params.single_nfl_week_id
      ).to.deep.equal(['2024_REG_WEEK_5'])

      const written = JSON.parse(mockStorage.getItem('data_view_history_v1'))
      expect(written[0].version).to.equal(STORAGE_SCHEMA_VERSION)
    })

    it('returns null when the latest entry has an invalid table_state', () => {
      mockStorage.setItem(
        'data_view_history_v1',
        JSON.stringify([
          { timestamp: 0, table_state: { columns: [], prefix_columns: [] } }
        ])
      )
      expect(load_latest_snapshot('v1')).to.be.null
    })
  })

  describe('load_history', () => {
    it('migrates and writes back the full history', () => {
      const legacy = {
        timestamp: Date.now(),
        change_type: 'user_edit',
        table_state: {
          columns: [
            {
              column_id: 'player_dfs_salary',
              params: { year: [2024], week: [5], seas_type: ['REG'] }
            }
          ],
          prefix_columns: ['player_name'],
          sort: [],
          where: []
        }
      }
      mockStorage.setItem(
        'data_view_history_v1',
        JSON.stringify([legacy, legacy])
      )

      const history = load_history('v1')
      expect(history).to.have.lengthOf(2)
      for (const snap of history) {
        expect(snap.version).to.equal(STORAGE_SCHEMA_VERSION)
        expect(
          snap.table_state.columns[0].params.single_nfl_week_id
        ).to.deep.equal(['2024_REG_WEEK_5'])
      }
    })
  })

  describe('clear_view', () => {
    it('removes history and metadata entry', () => {
      save_snapshot({
        view_id: 'v1',
        table_state: make_state(),
        change_type: 'user_edit',
        is_new_view: false
      })
      clear_view('v1')
      expect(mockStorage.getItem('data_view_history_v1')).to.be.null
      const metadata = JSON.parse(mockStorage.getItem('data_view_metadata'))
      expect(metadata.view_access_times).to.not.have.property('v1')
    })
  })

  describe('clear_all', () => {
    it('removes all history keys, metadata, and last-active', () => {
      save_snapshot({
        view_id: 'v1',
        table_state: make_state(),
        change_type: 'user_edit',
        is_new_view: false
      })
      save_snapshot({
        view_id: 'v2',
        table_state: make_state(),
        change_type: 'user_edit',
        is_new_view: false
      })
      save_last_active_view('v1')
      clear_all()
      expect(mockStorage.getItem('data_view_history_v1')).to.be.null
      expect(mockStorage.getItem('data_view_history_v2')).to.be.null
      expect(mockStorage.getItem('data_view_metadata')).to.be.null
      expect(mockStorage.getItem('data_view_last_active')).to.be.null
    })
  })

  describe('reconcile_server_views', () => {
    it('evicts view_ids missing from both server and redux lists', () => {
      save_snapshot({
        view_id: 'v1',
        table_state: make_state(),
        change_type: 'user_edit',
        is_new_view: false
      })
      save_snapshot({
        view_id: 'v2',
        table_state: make_state(),
        change_type: 'user_edit',
        is_new_view: false
      })
      reconcile_server_views({
        server_view_ids: ['v1'],
        redux_view_ids: ['v1']
      })
      expect(mockStorage.getItem('data_view_history_v1')).to.not.be.null
      expect(mockStorage.getItem('data_view_history_v2')).to.be.null
    })

    it('preserves client-generated views present in redux but not on server', () => {
      save_snapshot({
        view_id: 'client-new',
        table_state: make_state(),
        change_type: 'user_edit',
        is_new_view: false
      })
      reconcile_server_views({
        server_view_ids: [],
        redux_view_ids: ['client-new']
      })
      expect(mockStorage.getItem('data_view_history_client-new')).to.not.be.null
    })

    it('never evicts DEFAULT_VIEW_IDS even if metadata has stale entries', () => {
      // Seed metadata with a default id
      const metadata = {
        view_access_times: { SEASON_FANTASY_POINTS: Date.now() },
        last_cleanup: null
      }
      mockStorage.setItem('data_view_metadata', JSON.stringify(metadata))
      mockStorage.setItem(
        'data_view_history_SEASON_FANTASY_POINTS',
        JSON.stringify([])
      )
      reconcile_server_views({ server_view_ids: [], redux_view_ids: [] })
      expect(mockStorage.getItem('data_view_history_SEASON_FANTASY_POINTS')).to
        .not.be.null
    })
  })

  describe('last active view', () => {
    it('round-trips via save_last_active_view / load_last_active_view', () => {
      save_last_active_view('v-active')
      const result = load_last_active_view()
      expect(result.view_id).to.equal('v-active')
      expect(result.timestamp).to.be.a('number')
    })

    it('returns null when unset', () => {
      expect(load_last_active_view()).to.be.null
    })
  })

  describe('get_all_stored_view_ids', () => {
    it('returns an array of view ids from metadata', () => {
      save_snapshot({
        view_id: 'v1',
        table_state: make_state(),
        change_type: 'user_edit',
        is_new_view: false
      })
      save_snapshot({
        view_id: 'v2',
        table_state: make_state(),
        change_type: 'user_edit',
        is_new_view: false
      })
      const ids = get_all_stored_view_ids()
      expect(ids).to.be.an('array')
      expect(ids.sort()).to.deep.equal(['v1', 'v2'])
    })
  })

  describe('quota recovery', () => {
    it('retries full write after LRU eviction and does not collapse history', () => {
      // Seed more than MAX_VIEWS_CACHED entries in metadata (so eviction has
      // something to prune) and exercise a quota-exceeded scenario.
      const metadata = { view_access_times: {}, last_cleanup: null }
      for (let i = 0; i < MAX_VIEWS_CACHED + 5; i++) {
        metadata.view_access_times[`old-${i}`] = i // old -> smallest timestamps
        mockStorage.setItem(
          `data_view_history_old-${i}`,
          JSON.stringify([
            {
              version: STORAGE_SCHEMA_VERSION,
              timestamp: 0,
              change_type: 'user_edit',
              table_state: { columns: [], prefix_columns: ['player_name'] }
            }
          ])
        )
      }
      mockStorage.setItem('data_view_metadata', JSON.stringify(metadata))

      let throw_once = true
      const original_set = mockStorage.setItem.bind(mockStorage)
      mockStorage.setItem = (key, value) => {
        if (throw_once && key === 'data_view_history_new') {
          throw_once = false
          const err = new Error('QuotaExceededError')
          err.name = 'QuotaExceededError'
          throw err
        }
        return original_set(key, value)
      }

      const ok = save_snapshot({
        view_id: 'new',
        table_state: make_state(),
        change_type: 'user_edit',
        is_new_view: false
      })
      expect(ok).to.be.true
      const history = JSON.parse(mockStorage.getItem('data_view_history_new'))
      expect(history).to.have.lengthOf(1)
    })

    it('invokes on_quota_exceeded callback on repeat failure', () => {
      let callback_args = null
      init_storage({
        on_quota_exceeded: (args) => {
          callback_args = args
        }
      })
      const original_set = mockStorage.setItem.bind(mockStorage)
      mockStorage.setItem = (key, value) => {
        if (key === 'data_view_history_v-full') {
          const err = new Error('QuotaExceededError')
          err.name = 'QuotaExceededError'
          throw err
        }
        return original_set(key, value)
      }
      const ok = save_snapshot({
        view_id: 'v-full',
        table_state: make_state(),
        change_type: 'user_edit',
        is_new_view: false
      })
      expect(ok).to.be.false
      expect(callback_args).to.deep.equal({ view_id: 'v-full' })
    })
  })
})
