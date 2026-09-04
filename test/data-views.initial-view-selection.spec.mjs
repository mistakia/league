/* global describe it */
import * as chai from 'chai'

import resolve_initial_view_selection from '#app/core/data-views/resolve-initial-view-selection.mjs'

const { expect } = chai

// THE PAGE MUST NOT CHANGE ITS MIND. Before this rule existed, /data-views
// mounted on the default view, rendered it with no query in flight, and then
// switched to loading the remembered view once GET /api/data-views landed --
// every field it needed to do better was already in localStorage, which is
// synchronous.
//
// The rule is separated from the saga because the saga cannot be imported here:
// it reaches `@core/ws`, which reads `window` at module scope.

const DEFAULT_VIEW_ID = 'SEASON_PROJECTIONS'
const DEFAULT_VIEW_IDS = new Set([DEFAULT_VIEW_ID, 'SEASON_FANTASY_POINTS'])

const make_table_state = (overrides = {}) => ({
  columns: ['player_age'],
  prefix_columns: ['player_name'],
  sort: [],
  where: [],
  ...overrides
})

const resolve = (args) =>
  resolve_initial_view_selection({
    default_view_id: DEFAULT_VIEW_ID,
    default_view_ids: DEFAULT_VIEW_IDS,
    ...args
  })

describe('data-views initial view selection', function () {
  it('restores the remembered view when its state is in the browser', function () {
    const table_state = make_table_state()
    const selection = resolve({
      last_active: { view_id: 'saved-1', view_name: 'My View' },
      snapshot: { table_state }
    })

    expect(selection.type).to.equal('restore')
    expect(selection.view_id).to.equal('saved-1')
    expect(selection.table_state).to.deep.equal(table_state)
    expect(selection.view_name).to.equal('My View')
  })

  it('selects the default when nothing is remembered', function () {
    // The default is SELECTED rather than left to the reducer's initial value:
    // the selection is what carries view_state_changed, so without it the page
    // renders the default view with no query until the list arrives.
    const selection = resolve({ last_active: null, snapshot: null })

    expect(selection.type).to.equal('default')
    expect(selection.view_id).to.equal(DEFAULT_VIEW_ID)
  })

  it('selects the default when the remembered view is a built-in one', function () {
    const selection = resolve({
      last_active: { view_id: 'SEASON_FANTASY_POINTS' },
      snapshot: null
    })

    expect(selection.type).to.equal('default')
    expect(selection.view_id).to.equal(DEFAULT_VIEW_ID)
  })

  it('defers when the remembered view has no local state', function () {
    // The case that must NOT resolve to a selection. Selecting a view the store
    // has never seen falls back to the default view's table_state, so the page
    // would query the DEFAULT view's columns under the remembered view's id.
    const selection = resolve({
      last_active: { view_id: 'saved-1' },
      snapshot: null
    })

    expect(selection.type).to.equal('defer')
    expect(selection.view_id).to.equal(undefined)
  })

  it('restores from the last-active record when there is no snapshot', function () {
    // The gap that kept the original defect alive after the first fix. A
    // snapshot is written only on an EDIT, so a saved view the user SELECTED
    // and never modified had no local state and deferred to the server -- which
    // is the default-view frame, unchanged. The last-active record caches the
    // state the view had when it was made active, so this case resolves now.
    const table_state = make_table_state()
    const selection = resolve({
      last_active: { view_id: 'saved-1', view_name: 'My View', table_state },
      snapshot: null
    })

    expect(selection.type).to.equal('restore')
    expect(selection.view_id).to.equal('saved-1')
    expect(selection.table_state).to.deep.equal(table_state)
  })

  it('prefers the snapshot over the last-active record', function () {
    // The snapshot is the EDITED state; the cached one is what the view held
    // before those edits. Restoring the older of the two would silently discard
    // the user's unsaved work on the first frame.
    const snapshot_state = make_table_state({ columns: ['player_age'] })
    const cached_state = make_table_state({ columns: ['player_height'] })
    const selection = resolve({
      last_active: { view_id: 'saved-1', table_state: cached_state },
      snapshot: { table_state: snapshot_state }
    })

    expect(selection.type).to.equal('restore')
    expect(selection.table_state).to.deep.equal(snapshot_state)
  })

  it('falls back to the last-active record when the snapshot is corrupt', function () {
    const table_state = make_table_state()
    const selection = resolve({
      last_active: { view_id: 'saved-1', table_state },
      snapshot: { table_state: { columns: 'not-an-array' } }
    })

    expect(selection.type).to.equal('restore')
    expect(selection.table_state).to.deep.equal(table_state)
  })

  it('defers when the cached last-active state is not valid either', function () {
    const selection = resolve({
      last_active: { view_id: 'saved-1', table_state: { columns: 'nope' } },
      snapshot: null
    })

    expect(selection.type).to.equal('defer')
  })

  it('defers on a snapshot whose table_state is not valid', function () {
    // The control for the test above: a stored snapshot is not automatically
    // usable, and a corrupt one must take the same path as an absent one rather
    // than being restored onto the page.
    const selection = resolve({
      last_active: { view_id: 'saved-1' },
      snapshot: { table_state: { columns: 'not-an-array' } }
    })

    expect(selection.type).to.equal('defer')
  })
})
