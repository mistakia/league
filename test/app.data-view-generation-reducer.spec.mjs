/* global describe it */
import * as chai from 'chai'

import { data_view_generation_reducer } from '@core/data-view-generation/reducer'
import { data_view_generation_actions } from '@core/data-view-generation/actions'

const expect = chai.expect

// Three of this reducer's five cases are SERVER FRAMES, dispatched into the
// store verbatim by the websocket service. So the spec drives them as the wire
// shapes api/sockets/data-view-generation.mjs actually sends
// (project_generation_job, plus queue_depth on ACCEPTED and error_code/message
// on ERROR) rather than through a creator, because there is no creator to drive
// -- and a spec inventing its own payload shape would pass against a reducer
// that could never read a real frame.

const accepted = (payload) => ({
  type: data_view_generation_actions.DATA_VIEW_GENERATION_ACCEPTED,
  payload
})
const update = (payload) => ({
  type: data_view_generation_actions.DATA_VIEW_GENERATION_UPDATE,
  payload
})
const error = (payload) => ({
  type: data_view_generation_actions.DATA_VIEW_GENERATION_ERROR,
  payload
})

describe('data view generation reducer', function () {
  it('starts with no run', function () {
    const state = data_view_generation_reducer(undefined, { type: '@@INIT' })
    expect(state.get('generation_id')).to.equal(null)
    expect(state.get('status')).to.equal(null)
  })

  it('holds the instruction while the submit is in flight', function () {
    const state = data_view_generation_reducer(
      undefined,
      data_view_generation_actions.submit_data_view_generation({
        instruction: 'top wide receivers by receiving yards in 2023'
      })
    )
    expect(state.get('status')).to.equal('submitting')
    expect(state.get('instruction')).to.equal(
      'top wide receivers by receiving yards in 2023'
    )
    // No id yet, and this is the whole reason `submitting` is not a job status:
    // the queue can still refuse.
    expect(state.get('generation_id')).to.equal(null)
  })

  it('takes the id and the queue depth off the accepted frame', function () {
    const state = data_view_generation_reducer(
      undefined,
      accepted({
        generation_id: 'gen-1',
        status: 'queued',
        instruction: 'top receivers',
        queue_depth: 3,
        max_queue_depth: 8
      })
    )
    expect(state.get('generation_id')).to.equal('gen-1')
    expect(state.get('status')).to.equal('queued')
    expect(state.get('queue_depth')).to.equal(3)
    expect(state.get('max_queue_depth')).to.equal(8)
  })

  it('carries the result and the trajectory through to completion', function () {
    let state = data_view_generation_reducer(
      undefined,
      accepted({ generation_id: 'gen-1', status: 'queued' })
    )
    state = data_view_generation_reducer(
      state,
      update({
        generation_id: 'gen-1',
        status: 'completed',
        generation_branch: 'registry',
        result: {
          expressible: true,
          explanation: 'sorted by receiving yards',
          inexpressible_reason: '',
          table_state: { columns: ['player_name'] }
        },
        tool_call_count: 12,
        total_tokens: 41000,
        duration_milliseconds: 183000
      })
    )
    expect(state.get('status')).to.equal('completed')
    expect(state.get('generation_branch')).to.equal('registry')
    expect(state.getIn(['result', 'table_state', 'columns']).toJS()).to.eql([
      'player_name'
    ])
    expect(state.get('tool_call_count')).to.equal(12)
    expect(state.get('duration_milliseconds')).to.equal(183000)
  })

  // The load-bearing negative control. The server stops POLLING on a socket
  // close but the RUN continues, so a watcher for a superseded generation can
  // still deliver a frame after the client has moved on -- and applying it
  // would put the abandoned run's status back over the live one.
  it('ignores an update for a generation it is no longer tracking', function () {
    let state = data_view_generation_reducer(
      undefined,
      accepted({ generation_id: 'gen-2', status: 'queued' })
    )
    state = data_view_generation_reducer(
      state,
      update({ generation_id: 'gen-1', status: 'completed' })
    )
    expect(state.get('status')).to.equal('queued')
    expect(state.get('generation_id')).to.equal('gen-2')

    // ... and applies one that IS for the tracked run, so the assertion above
    // cannot be passing because the reducer ignores every update.
    state = data_view_generation_reducer(
      state,
      update({ generation_id: 'gen-2', status: 'running' })
    )
    expect(state.get('status')).to.equal('running')
  })

  it('applies an admission refusal, which carries no generation_id', function () {
    let state = data_view_generation_reducer(
      undefined,
      data_view_generation_actions.submit_data_view_generation({
        instruction: 'top receivers'
      })
    )
    state = data_view_generation_reducer(
      state,
      error({
        generation_id: null,
        error_code: 'queue_full',
        message: 'generation queue is at its depth limit of 8',
        queue_depth: 8,
        max_queue_depth: 8
      })
    )
    expect(state.get('status')).to.equal('failed')
    expect(state.get('error_code')).to.equal('queue_full')
    // The depth is what lets the control say how full the queue is rather than
    // rendering a generic error.
    expect(state.get('queue_depth')).to.equal(8)
    expect(state.get('max_queue_depth')).to.equal(8)
  })

  it('keeps a refusal the agent made as a completed job', function () {
    let state = data_view_generation_reducer(
      undefined,
      accepted({ generation_id: 'gen-3', status: 'queued' })
    )
    state = data_view_generation_reducer(
      state,
      update({
        generation_id: 'gen-3',
        status: 'completed',
        generation_branch: 'refusal',
        result: {
          expressible: false,
          explanation: '',
          inexpressible_reason: 'no column carries snap-weighted target share'
        }
      })
    )
    // NOT `failed`. A refusal is an answer, and filing it as a failure would
    // fold it in with the provider being unreachable.
    expect(state.get('status')).to.equal('completed')
    expect(state.get('generation_branch')).to.equal('refusal')
    expect(state.get('error_code')).to.equal(null)
  })

  it('clears everything on dismiss', function () {
    let state = data_view_generation_reducer(
      undefined,
      accepted({ generation_id: 'gen-4', status: 'running' })
    )
    state = data_view_generation_reducer(
      state,
      data_view_generation_actions.dismiss_data_view_generation()
    )
    expect(state.get('generation_id')).to.equal(null)
    expect(state.get('status')).to.equal(null)
  })
})
