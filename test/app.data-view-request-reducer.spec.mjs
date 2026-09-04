/* global describe it */
import * as chai from 'chai'

import { data_view_request_reducer } from '@core/data-view-request/reducer'
import { data_view_request_actions } from '@core/data-view-request/actions'
import { data_views_actions } from '@core/data-views/actions'

const expect = chai.expect

// The defect this covers: a view change enters `pending` OPTIMISTICALLY, because
// the reducer runs before the saga and cannot know whether a request will
// actually be sent. A view with no columns sends none, and until
// DATA_VIEW_REQUEST_SKIPPED existed nothing moved the slice back off `pending` --
// so a brand-new view (which starts with zero columns) sat under a progress bar
// and a "Request queued..." banner for the life of the page.
//
// The two cases are asserted as a PAIR on purpose. Asserting only the second
// would pass against a reducer that never entered `pending` at all, which is a
// different system than the one shipping.

const view_changed = (data_view) => ({
  type: data_views_actions.DATA_VIEW_CHANGED,
  payload: {
    data_view,
    view_change_params: { view_state_changed: true }
  }
})

describe('data view request reducer', function () {
  it('enters pending on a view change, before the saga has decided', function () {
    const state = data_view_request_reducer(
      undefined,
      view_changed({ view_id: 'view-1' })
    )
    expect(state.get('status')).to.equal('pending')
    expect(state.get('current_request')).to.equal('view-1')
  })

  it('leaves pending when the saga declines to send a request', function () {
    const pending = data_view_request_reducer(
      undefined,
      view_changed({ view_id: 'view-1' })
    )
    const state = data_view_request_reducer(
      pending,
      data_view_request_actions.data_view_request_skipped()
    )
    expect(state.get('status')).to.equal(null)
    expect(state.get('current_request')).to.equal(null)
    expect(state.get('result').size).to.equal(0)
    expect(state.get('metadata')).to.equal(null)
  })

  it('clears a previous error so a skipped request shows no stale banner', function () {
    const errored = data_view_request_reducer(undefined, {
      type: data_view_request_actions.DATA_VIEW_ERROR,
      payload: { error: 'boom', is_invalid_request: true }
    })
    expect(errored.get('status')).to.equal('error')

    const state = data_view_request_reducer(
      errored,
      data_view_request_actions.data_view_request_skipped()
    )
    expect(state.get('status')).to.equal(null)
    expect(state.get('error')).to.equal(null)
    expect(state.get('is_invalid_request')).to.equal(false)
  })
})
