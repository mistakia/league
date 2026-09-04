/* global describe it */
import fs from 'fs'
import path from 'path'

import * as chai from 'chai'

import {
  may_apply_generation_to_view,
  resolve_view_to_restore
} from '@core/data-view-generation/view-authority'

const expect = chai.expect

// A generation runs for up to fifteen minutes and the user may switch views
// inside that window. Until 2026-09-04 `handle_generation_update` applied the
// result to `get_selected_data_view` -- whichever view is selected when the
// answer lands -- so a run started on view A and collected while view B was
// open REPLACED view B's table_state. That is data loss on the view the user is
// actually looking at, and the field that prevents it, `pending.view_id`, was
// already persisted and read by nothing.
//
// The saga itself is not importable from a spec: it reaches @core/ws and
// therefore @core/store, which reads `window` at module scope and runs
// rootSaga on import. Stubbing that was attempted and abandoned -- the stub
// grew to window, document, their mutual defaultView reference and a hot-module
// `module` global, and a spec whose fixture is a hand-built browser is testing
// the fixture. So the RULE lives in its own module and is tested directly, and
// the two things only the saga can get wrong are held by a source scan below.

describe('data view generation view authority', function () {
  it('applies a run that finishes on the view it started from', function () {
    expect(
      may_apply_generation_to_view({
        pending: { generation_id: 'g1', view_id: 'view-a' },
        data_view: { view_id: 'view-a' }
      })
    ).to.equal(true)
  })

  // The defect, stated as a test. Returns true against the pre-fix behaviour,
  // which consulted nothing and applied to the selected view unconditionally.
  it('refuses a run started on another view', function () {
    expect(
      may_apply_generation_to_view({
        pending: { generation_id: 'g1', view_id: 'view-a' },
        data_view: { view_id: 'view-b' }
      })
    ).to.equal(false)
  })

  it('applies when the run was accepted with no view selected', function () {
    // A null view_id means there was nothing to protect, not that the run
    // belongs to the current view by default.
    expect(
      may_apply_generation_to_view({
        pending: { generation_id: 'g1', view_id: null },
        data_view: { view_id: 'view-b' }
      })
    ).to.equal(true)
  })

  it('applies when no stored record survives, which is not evidence of a mismatch', function () {
    // Absence covers a run predating the field, another tab's record, and
    // cleared storage. Refusing on it would break runs that work today.
    expect(
      may_apply_generation_to_view({
        pending: null,
        data_view: { view_id: 'view-b' }
      })
    ).to.equal(true)
  })

  it('refuses when there is no view to apply to', function () {
    expect(
      may_apply_generation_to_view({
        pending: { generation_id: 'g1', view_id: 'view-a' },
        data_view: null
      })
    ).to.equal(false)
  })
})

// The two properties the rule module cannot hold on its own, because they are
// facts about the CALLER: that the saga consults the rule at all, and that it
// reads the stored record before clear_pending_generation destroys it. A rule
// that is never called and a record read after it is cleared both produce
// exactly the pre-fix behaviour.
describe('data view generation view authority wiring', function () {
  const saga_path = path.resolve('app/core/data-view-generation/sagas.js')
  const source = fs.readFileSync(saga_path, 'utf8')

  it('reads a source file with the handler in it, so a zero cannot be vacuous', function () {
    expect(source).to.contain('function* handle_generation_update')
  })

  // Anchored on the CALL, not on the name. A first attempt asserted the bare
  // identifier and passed against a saga with the guard deleted, because the
  // import line still carried the token -- the name present in a different
  // syntactic role proved nothing about the role under test.
  it('consults the rule before applying a result', function () {
    expect(source).to.match(/if \(!may_apply_generation_to_view\(/)
  })

  it('loads the pending record before clearing it', function () {
    const load_at = source.indexOf('yield call(load_pending_generation)')
    const clear_at = source.indexOf('yield call(clear_pending_generation)')

    expect(load_at).to.not.equal(-1)
    expect(clear_at).to.not.equal(-1)
    expect(load_at).to.be.lessThan(clear_at)
  })
})

describe('which view is restored at mount', function () {
  // View restoration and job restoration used to initialize independently, so a
  // reload during a run could restore view B while re-attaching to a job started
  // on view A -- and the answer would then be correctly refused, leaving the user
  // watching a run whose result can never appear.
  const default_view_id = 'DEFAULT'

  it('prefers the PENDING run view over last-active', function () {
    expect(
      resolve_view_to_restore({
        pending: { view_id: 'A' },
        last_active: { view_id: 'B' },
        all_view_ids: new Set(['A', 'B']),
        default_view_id
      })
    ).to.equal('A')
  })

  it('falls back to last-active when there is no pending run', function () {
    // The control for the case above. Without it, a rule that always returned
    // last_active would pass nothing, and one that always returned pending
    // would break every ordinary load.
    expect(
      resolve_view_to_restore({
        pending: null,
        last_active: { view_id: 'B' },
        all_view_ids: new Set(['A', 'B']),
        default_view_id
      })
    ).to.equal('B')
  })

  it('is unchanged when pending and last-active AGREE', function () {
    expect(
      resolve_view_to_restore({
        pending: { view_id: 'A' },
        last_active: { view_id: 'A' },
        all_view_ids: new Set(['A']),
        default_view_id
      })
    ).to.equal('A')
  })

  it('ignores a pending view that no longer EXISTS', function () {
    // A stored id outlives the view it names -- deleted on another device, or
    // never synced here. Selecting it would restore nothing at all.
    expect(
      resolve_view_to_restore({
        pending: { view_id: 'GONE' },
        last_active: { view_id: 'B' },
        all_view_ids: new Set(['B']),
        default_view_id
      })
    ).to.equal('B')
  })

  it('falls through to the default when neither stored id exists', function () {
    expect(
      resolve_view_to_restore({
        pending: { view_id: 'GONE' },
        last_active: { view_id: 'ALSO_GONE' },
        all_view_ids: new Set(['B']),
        default_view_id
      })
    ).to.equal(default_view_id)
  })

  it('falls through to the default with nothing stored at all', function () {
    expect(
      resolve_view_to_restore({
        pending: null,
        last_active: null,
        all_view_ids: new Set(['B']),
        default_view_id
      })
    ).to.equal(default_view_id)
  })

  it('ignores a pending record carrying a NULL view_id', function () {
    // A run accepted with no view selected. There is no origin view to prefer.
    expect(
      resolve_view_to_restore({
        pending: { view_id: null },
        last_active: { view_id: 'B' },
        all_view_ids: new Set(['B']),
        default_view_id
      })
    ).to.equal('B')
  })
})
