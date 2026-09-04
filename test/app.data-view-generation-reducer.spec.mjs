/* global describe it */
import * as chai from 'chai'

import { data_view_generation_reducer } from '@core/data-view-generation/reducer'
import { data_view_generation_actions } from '@core/data-view-generation/actions'

const expect = chai.expect

// Five of this reducer's seven cases are SERVER FRAMES, dispatched into the
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
const backfill = (payload) => ({
  type: data_view_generation_actions.DATA_VIEW_GENERATION_TIMELINE_BACKFILL,
  payload
})
const timeline_entry = (payload) => ({
  type: data_view_generation_actions.DATA_VIEW_GENERATION_TIMELINE_ENTRY,
  payload
})

// An entry in the shape base actually emits: content plus the dense ordering
// key the reducer sorts and de-duplicates on.
const entry_at = (index, content) => ({
  id: `e${index}`,
  type: 'tool_call',
  content,
  ordering: { timeline_index: index, timeline_epoch: 1 }
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

  describe('the agent session timeline', function () {
    const with_run = (generation_id) =>
      data_view_generation_reducer(
        undefined,
        accepted({ generation_id, status: 'running' })
      )

    it('holds backfilled entries with their CONTENT', function () {
      let state = with_run('gen-t1')
      state = data_view_generation_reducer(
        state,
        backfill({
          generation_id: 'gen-t1',
          entries: [entry_at(0, 'searched columns')],
          timeline_window: { epoch: 1 },
          is_redacted: false
        })
      )
      // On CONTENT, not on length. A masked timeline has the same entry count
      // as a real one, so a count assertion passes against a redacted read.
      expect(state.getIn(['timeline_entries', 0, 'content'])).to.equal(
        'searched columns'
      )
      expect(state.get('timeline_is_redacted')).to.equal(false)
    })

    it('DE-DUPLICATES a backfill that overlaps a live tail', function () {
      // The defect this covers: an attach issues a backfill while entries are
      // already arriving live, so the same timeline_index arrives twice. Taking
      // arrival order would render the overlap twice.
      let state = with_run('gen-t2')
      state = data_view_generation_reducer(
        state,
        backfill({
          generation_id: 'gen-t2',
          entries: [entry_at(0, 'first'), entry_at(1, 'second')],
          timeline_window: { epoch: 1 },
          is_redacted: false
        })
      )
      state = data_view_generation_reducer(
        state,
        timeline_entry({
          generation_id: 'gen-t2',
          entry: entry_at(1, 'second')
        })
      )
      state = data_view_generation_reducer(
        state,
        timeline_entry({ generation_id: 'gen-t2', entry: entry_at(2, 'third') })
      )

      expect(
        state
          .get('timeline_entries')
          .map((e) => e.getIn(['ordering', 'timeline_index']))
          .toJS()
      ).to.deep.equal([0, 1, 2])
    })

    it('ORDERS by timeline_index, not by arrival', function () {
      // An in-order fixture cannot distinguish the two rules and would pass
      // against either, so this one arrives deliberately scrambled.
      let state = with_run('gen-t3')
      state = data_view_generation_reducer(
        state,
        timeline_entry({ generation_id: 'gen-t3', entry: entry_at(2, 'third') })
      )
      state = data_view_generation_reducer(
        state,
        timeline_entry({ generation_id: 'gen-t3', entry: entry_at(0, 'first') })
      )
      state = data_view_generation_reducer(
        state,
        timeline_entry({
          generation_id: 'gen-t3',
          entry: entry_at(1, 'second')
        })
      )

      expect(
        state
          .get('timeline_entries')
          .map((e) => e.get('content'))
          .toJS()
      ).to.deep.equal(['first', 'second', 'third'])
    })

    it('IGNORES a frame for a different run', function () {
      // Guarded exactly as UPDATE is: a watcher still relaying the previous
      // generation would otherwise put its timeline over the new run's.
      let state = with_run('gen-t4')
      state = data_view_generation_reducer(
        state,
        backfill({
          generation_id: 'gen-OTHER',
          entries: [entry_at(0, 'not ours')],
          timeline_window: null,
          is_redacted: false
        })
      )
      expect(state.get('timeline_entries').size).to.equal(0)
    })

    it('carries a MASKED backfill through as redacted', function () {
      let state = with_run('gen-t5')
      state = data_view_generation_reducer(
        state,
        backfill({
          generation_id: 'gen-t5',
          entries: [
            { ...entry_at(0, '\u2588\u2588\u2588'), is_redacted: true }
          ],
          timeline_window: null,
          is_redacted: true
        })
      )
      expect(state.get('timeline_is_redacted')).to.equal(true)
    })

    it('clears the timeline on dismiss', function () {
      let state = with_run('gen-t6')
      state = data_view_generation_reducer(
        state,
        backfill({
          generation_id: 'gen-t6',
          entries: [entry_at(0, 'searched columns')],
          timeline_window: null,
          is_redacted: false
        })
      )
      state = data_view_generation_reducer(
        state,
        data_view_generation_actions.dismiss_data_view_generation()
      )
      expect(state.get('timeline_entries').size).to.equal(0)
    })
  })
})
