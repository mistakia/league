/* global describe it beforeEach */
import * as chai from 'chai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  execute_data_view_request,
  get_admission_state,
  reset_admission_state
} from '../libs-server/data-views/execute-data-view-request.mjs'
import {
  handle_data_view_request,
  handle_client_timing
} from '../api/sockets/data_view.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const executor_path = path.join(
  __dirname,
  '../libs-server/data-views/execute-data-view-request.mjs'
)

chai.should()
const expect = chai.expect

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const make_ws = () => {
  const sent = []
  return {
    readyState: 1,
    client_id: 'test-client',
    sent,
    send: (message) => {
      sent.push(JSON.parse(message))
      return true
    }
  }
}

const sample_params = () => ({
  columns: [{ column_id: 'player_fantasy_points', params: { year: [2023] } }],
  row_axes: ['year'],
  where: [],
  sort: [],
  offset: 0,
  limit: 100,
  append_results: false
})

const empty_result = () => ({ data_view_results: [], data_view_metadata: {} })

// A slot held until the spec says otherwise. Sleeps make a concurrency spec
// assert on a race; a gate makes it assert on the gate.
const make_gate = () => {
  let release = null
  const promise = new Promise((resolve) => {
    release = resolve
  })
  return { promise, release }
}

// Whether a request was ADMITTED, distinguished from a request that is still
// queued -- without waiting on a promise that a starving gate would never
// settle. A regression here must report as a failed assertion, not as a mocha
// timeout.
const admission_outcome = async (promise, budget_ms = 150) =>
  Promise.race([
    promise.then(() => 'admitted'),
    sleep(budget_ms).then(() => 'blocked')
  ])

const expect_throws = async (promise) => {
  let threw = null
  try {
    await promise
  } catch (error) {
    threw = error
  }
  expect(threw, 'expected the promise to reject').to.exist
  return threw
}

describe('data view admission gate and instrumentation', function () {
  beforeEach(function () {
    reset_admission_state()
  })

  it('releases the slot when execution throws, so a later request still runs', async function () {
    const boom = async () => {
      throw new Error('boom')
    }
    await expect_throws(
      execute_data_view_request({
        request_id: 'v',
        params: sample_params(),
        user_id: null,
        path: 'socket',
        cache_key: 'k-boom',
        run_query: boom,
        cache_get: async () => null
      })
    )

    // A subsequent request must acquire the freed slot and complete.
    let ran = false
    await execute_data_view_request({
      request_id: 'v2',
      params: sample_params(),
      user_id: null,
      path: 'socket',
      cache_key: 'k-ok',
      run_query: async () => {
        ran = true
        return empty_result()
      },
      cache_get: async () => null
    })
    expect(ran).to.equal(true)
    expect(get_admission_state().active_request_count).to.equal(0)
  })

  it('never executes a waiter that was superseded while waiting', async function () {
    // Fill the gate's capacity so a further request must queue as a waiter; the
    // cap is read from the module, not hardcoded, so this stays correct when
    // DATA_VIEW_MAX_CONCURRENT_QUERIES changes.
    const cap = get_admission_state().max_concurrent_queries
    const controller = new AbortController()
    const holders = Array.from({ length: cap }, (_, i) =>
      execute_data_view_request({
        request_id: `h${i}`,
        params: sample_params(),
        user_id: null,
        path: 'socket',
        cache_key: `k-holder-${i}`,
        run_query: async () => {
          await sleep(150)
          return empty_result()
        },
        cache_get: async () => null
      })
    )
    await sleep(20)

    let executed = false
    const waiter = execute_data_view_request({
      request_id: 'v2',
      params: sample_params(),
      user_id: null,
      path: 'socket',
      cache_key: 'k-waiter',
      signal: controller.signal,
      run_query: async () => {
        executed = true
        return empty_result()
      },
      cache_get: async () => null
    })
    await sleep(20)
    controller.abort()
    await expect_throws(waiter)
    await Promise.all(holders)
    expect(executed).to.equal(false)
    expect(get_admission_state().active_request_count).to.equal(0)
  })

  it('refuses a request whose signal was already aborted before it arrived', async function () {
    // An already-aborted signal never fires its abort listener, so a gate that
    // only subscribes admits and EXECUTES the request. Asserted on both sides of
    // the gate, because the two arms are different code: the free-slot fast path
    // and the queued path.
    let executed = false
    const aborted = new AbortController()
    aborted.abort()

    const on_free_gate = await expect_throws(
      execute_data_view_request({
        request_id: 'v',
        params: sample_params(),
        user_id: null,
        path: 'socket',
        cache_key: 'k-pre-aborted-free',
        signal: aborted.signal,
        run_query: async () => {
          executed = true
          return empty_result()
        },
        cache_get: async () => null
      })
    )
    expect(on_free_gate.code).to.equal('ABORTED')

    const holder_gate = make_gate()
    const holders = Array.from(
      { length: get_admission_state().max_concurrent_queries },
      (_, i) =>
        execute_data_view_request({
          request_id: `h${i}`,
          params: sample_params(),
          user_id: null,
          path: 'socket',
          cache_key: `k-pre-aborted-holder-${i}`,
          run_query: async () => {
            await holder_gate.promise
            return empty_result()
          },
          cache_get: async () => null
        })
    )
    await sleep(20)

    const on_full_gate = await expect_throws(
      execute_data_view_request({
        request_id: 'v2',
        params: sample_params(),
        user_id: null,
        path: 'socket',
        cache_key: 'k-pre-aborted-queued',
        signal: aborted.signal,
        run_query: async () => {
          executed = true
          return empty_result()
        },
        cache_get: async () => null
      })
    )
    expect(on_full_gate.code).to.equal('ABORTED')
    expect(
      get_admission_state().waiting_request_count,
      'the refused request left nothing in the queue'
    ).to.equal(0)

    holder_gate.release()
    await Promise.all(holders)
    expect(executed, 'neither aborted request ran its query').to.equal(false)
    expect(get_admission_state().active_request_count).to.equal(0)
  })

  it('fires a heartbeat while a request is still waiting for a slot', async function () {
    const cap = get_admission_state().max_concurrent_queries
    const heartbeats = []
    const holders = Array.from({ length: cap }, (_, i) =>
      execute_data_view_request({
        request_id: `h${i}`,
        params: sample_params(),
        user_id: null,
        path: 'socket',
        cache_key: `k-holder-${i}`,
        run_query: async () => {
          await sleep(120)
          return empty_result()
        },
        cache_get: async () => null
      })
    )
    await sleep(20)

    await execute_data_view_request({
      request_id: 'v2',
      params: sample_params(),
      user_id: null,
      path: 'socket',
      cache_key: 'k-waiting',
      on_heartbeat: (payload) => {
        heartbeats.push(payload.state)
        return true
      },
      run_query: async () => empty_result(),
      cache_get: async () => null,
      heartbeat_interval_ms: 20
    })
    await Promise.all(holders)

    expect(heartbeats, 'heartbeat fired during queue wait').to.include(
      'waiting'
    )
    expect(heartbeats, 'heartbeat fired during execution').to.include(
      'executing'
    )
  })

  it('keeps a slot reachable by an interactive request while bulk exports saturate the gate', async function () {
    // The failure this exists for: two API-key exports, each carrying a
    // 30-minute statement_timeout, occupying every slot while browser tables
    // queue behind them.
    const state = get_admission_state()
    const gate = make_gate()
    const exports_in_flight = Array.from(
      { length: state.max_concurrent_queries },
      (_, i) =>
        execute_data_view_request({
          request_id: null,
          params: sample_params(),
          user_id: null,
          path: 'export',
          cache_key: `k-export-${i}`,
          run_query: async () => {
            await gate.promise
            return empty_result()
          },
          cache_get: async () => null
        })
    )
    await sleep(20)

    const saturated = get_admission_state()
    expect(saturated.bulk.active_request_count).to.equal(
      saturated.max_concurrent_bulk_queries
    )
    expect(
      saturated.bulk.waiting_request_count,
      'the exports over the bulk sub-cap are queued, not running'
    ).to.equal(
      saturated.max_concurrent_queries - saturated.max_concurrent_bulk_queries
    )

    let interactive_ran = false
    const interactive = execute_data_view_request({
      request_id: 'v',
      params: sample_params(),
      user_id: null,
      path: 'socket',
      cache_key: 'k-interactive',
      run_query: async () => {
        interactive_ran = true
        return empty_result()
      },
      cache_get: async () => null
    })

    expect(await admission_outcome(interactive)).to.equal('admitted')
    expect(interactive_ran).to.equal(true)
    expect(
      get_admission_state().bulk.active_request_count,
      'the export was still in flight when the interactive request ran'
    ).to.equal(saturated.max_concurrent_bulk_queries)

    gate.release()
    await Promise.all(exports_in_flight)
    expect(get_admission_state().active_request_count).to.equal(0)
  })

  it('passes over a queued export that cannot run and admits the interactive request behind it', async function () {
    const order = []
    const export_gate = make_gate()
    const interactive_gate = make_gate()

    // One slot each, so the bulk sub-cap is full and the total budget is full.
    const running_export = execute_data_view_request({
      request_id: null,
      params: sample_params(),
      user_id: null,
      path: 'export',
      cache_key: 'k-skip-running-export',
      run_query: async () => {
        await export_gate.promise
        return empty_result()
      },
      cache_get: async () => null
    })
    const running_interactive = execute_data_view_request({
      request_id: 'h',
      params: sample_params(),
      user_id: null,
      path: 'socket',
      cache_key: 'k-skip-running-interactive',
      run_query: async () => {
        await interactive_gate.promise
        return empty_result()
      },
      cache_get: async () => null
    })
    await sleep(20)

    // The second export queues FIRST. It cannot run -- the bulk sub-cap is full
    // -- so a queue that STOPS at an ineligible head would park the interactive
    // waiter behind it for the running export's whole 30-minute budget.
    const queued_export = execute_data_view_request({
      request_id: null,
      params: sample_params(),
      user_id: null,
      path: 'export',
      cache_key: 'k-skip-queued-export',
      run_query: async () => {
        order.push('bulk')
        return empty_result()
      },
      cache_get: async () => null
    })
    await sleep(20)
    const interactive_waiter = execute_data_view_request({
      request_id: 'v',
      params: sample_params(),
      user_id: null,
      path: 'socket',
      cache_key: 'k-skip-interactive',
      run_query: async () => {
        order.push('interactive')
        return empty_result()
      },
      cache_get: async () => null
    })
    await sleep(20)
    expect(get_admission_state().waiting_request_count).to.equal(2)

    // Free the INTERACTIVE slot only. The export is still holding the bulk one.
    interactive_gate.release()
    await running_interactive
    expect(await admission_outcome(interactive_waiter)).to.equal('admitted')
    expect(
      order[0],
      'the interactive waiter did not wait on the export'
    ).to.equal('interactive')

    export_gate.release()
    await Promise.all([running_export, queued_export])
    expect(order).to.deep.equal(['interactive', 'bulk'])
    expect(get_admission_state().active_request_count).to.equal(0)
  })

  it('admits a waiting export ahead of a later interactive waiter once the sub-cap frees', async function () {
    // The other half of the discipline. Skipping an ineligible export must not
    // become an unbounded deferral: with no export running, the queued one is
    // eligible and arrival order governs, so it is admitted before an
    // interactive request that queued after it. Draining by class instead would
    // leave this export waiting on an empty interactive queue that a steady
    // stream of arrivals never produces.
    const order = []
    const holder_gates = [make_gate(), make_gate()]
    const holders = holder_gates.map((holder_gate, i) =>
      execute_data_view_request({
        request_id: `h${i}`,
        params: sample_params(),
        user_id: null,
        path: 'socket',
        cache_key: `k-order-holder-${i}`,
        run_query: async () => {
          await holder_gate.promise
          return empty_result()
        },
        cache_get: async () => null
      })
    )
    await sleep(20)

    const bulk_waiter = execute_data_view_request({
      request_id: null,
      params: sample_params(),
      user_id: null,
      path: 'export',
      cache_key: 'k-order-bulk',
      run_query: async () => {
        order.push('bulk')
        return empty_result()
      },
      cache_get: async () => null
    })
    await sleep(20)
    const interactive_waiter = execute_data_view_request({
      request_id: 'v',
      params: sample_params(),
      user_id: null,
      path: 'socket',
      cache_key: 'k-order-interactive',
      run_query: async () => {
        order.push('interactive')
        return empty_result()
      },
      cache_get: async () => null
    })
    await sleep(20)

    // Free exactly ONE slot, so the two waiters compete for it.
    holder_gates[0].release()
    await bulk_waiter
    expect(order[0], 'the earlier export took the freed slot').to.equal('bulk')

    holder_gates[1].release()
    await Promise.all([...holders, interactive_waiter])
    expect(order).to.deep.equal(['bulk', 'interactive'])
    expect(get_admission_state().active_request_count).to.equal(0)
  })

  it('classifies admissions by path and releases a superseded bulk waiter cleanly', async function () {
    const gate = make_gate()
    const controller = new AbortController()
    const running_export = execute_data_view_request({
      request_id: null,
      params: sample_params(),
      user_id: null,
      path: 'export',
      cache_key: 'k-class-export',
      run_query: async () => {
        await gate.promise
        return empty_result()
      },
      cache_get: async () => null
    })
    await sleep(20)

    let queued_export_ran = false
    const queued_export = execute_data_view_request({
      request_id: null,
      params: sample_params(),
      user_id: null,
      path: 'export',
      cache_key: 'k-class-export-2',
      signal: controller.signal,
      run_query: async () => {
        queued_export_ran = true
        return empty_result()
      },
      cache_get: async () => null
    })
    await sleep(20)
    controller.abort()
    await expect_throws(queued_export)

    await execute_data_view_request({
      request_id: 'v',
      params: sample_params(),
      user_id: null,
      path: 'socket',
      cache_key: 'k-class-socket',
      run_query: async () => empty_result(),
      cache_get: async () => null
    })

    gate.release()
    await running_export

    const { counters, bulk, active_request_count } = get_admission_state()
    expect(queued_export_ran).to.equal(false)
    expect(counters.bulk_admitted).to.equal(1)
    expect(counters.interactive_admitted).to.equal(1)
    expect(counters.admitted).to.equal(2)
    expect(counters.superseded_waiters).to.equal(1)
    expect(bulk.waiting_request_count).to.equal(0)
    expect(active_request_count).to.equal(0)
  })

  it('carries a shape descriptor that resolves the signature without any log', async function () {
    const emitted = []
    const wide_params = {
      ...sample_params(),
      view_id: 'view-abc',
      // Repeats collapse under `distinct`, which is the whole point: a
      // 181-column production view names about ten distinct columns.
      columns: [
        { column_id: 'player_rush_yds_from_plays', params: { year: [2024] } },
        { column_id: 'player_rush_yds_from_plays', params: { year: [2025] } },
        { column_id: 'player_name', params: {} }
      ],
      row_axes: ['year', 'week', 'line']
    }

    await execute_data_view_request({
      request_id: 'v',
      params: wide_params,
      user_id: 134,
      path: 'socket',
      cache_key: 'k-shape',
      run_query: async () => {
        await sleep(30)
        return { data_view_results: [{ pid: 'x' }], data_view_metadata: {} }
      },
      signal_emitter: async (args) => emitted.push(args),
      cache_get: async () => null,
      emission_threshold_ms: 10
    })

    expect(emitted.length).to.equal(1)
    const { shape } = emitted[0].payload
    expect(shape.kind).to.equal('columns')
    expect(shape.view_id).to.equal('view-abc')
    expect(shape.row_axes).to.eql(['year', 'week', 'line'])
    expect(shape.column_count).to.equal(3)
    expect(shape.distinct_column_id_count).to.equal(2)
    expect(shape.column_ids).to.eql([
      'player_name',
      'player_rush_yds_from_plays'
    ])
  })

  it('returns the result when a malformed shape makes slow-query reporting throw', async function () {
    // `columns` as a bare string is truthy and has no `.map`, so building the
    // payload throws. The report is called synchronously inside the executor's
    // own try, so before it was guarded this rethrew and failed a request whose
    // query had already succeeded AND already been cached -- the worst shape of
    // failure, since the work was done and paid for.
    const emitted = []

    const result = await execute_data_view_request({
      request_id: 'v',
      params: { columns: 'player_name', row_axes: [] },
      user_id: 134,
      path: 'socket',
      cache_key: 'k-malformed-shape',
      run_query: async () => {
        await sleep(30)
        return { data_view_results: [{ pid: 'x' }], data_view_metadata: {} }
      },
      signal_emitter: async (args) => emitted.push(args),
      cache_get: async () => null,
      emission_threshold_ms: 10
    })

    expect(result.data_view_results).to.eql([{ pid: 'x' }])
    expect(emitted.length).to.equal(0)
  })

  it('drops a column that carries no id rather than naming it null', async function () {
    const emitted = []

    await execute_data_view_request({
      request_id: 'v',
      params: {
        columns: [
          'player_name',
          { params: { year: [2024] } },
          null,
          { column_id: 'player_rush_yds_from_plays' }
        ],
        row_axes: []
      },
      user_id: 134,
      path: 'socket',
      cache_key: 'k-idless-column',
      run_query: async () => {
        await sleep(30)
        return { data_view_results: [{ pid: 'x' }], data_view_metadata: {} }
      },
      signal_emitter: async (args) => emitted.push(args),
      cache_get: async () => null,
      emission_threshold_ms: 10
    })

    const { shape } = emitted[0].payload
    expect(shape.column_ids).to.eql([
      'player_name',
      'player_rush_yds_from_plays'
    ])
    expect(shape.column_count).to.equal(4)
    expect(shape.distinct_column_id_count).to.equal(2)
  })

  it('describes a sandboxed-SQL shape by query_id and never by its statement', async function () {
    const emitted = []

    await execute_data_view_request({
      request_id: 'v',
      params: { query_id: 'q-42', sql_text: 'select 1 /* secret */' },
      user_id: 134,
      path: 'socket',
      cache_key: 'k-sql-shape',
      run_query: async () => {
        await sleep(30)
        return { data_view_results: [{ pid: 'x' }], data_view_metadata: {} }
      },
      signal_emitter: async (args) => emitted.push(args),
      cache_get: async () => null,
      emission_threshold_ms: 10
    })

    expect(emitted.length).to.equal(1)
    expect(emitted[0].payload.shape).to.eql({ kind: 'sql', query_id: 'q-42' })
    expect(JSON.stringify(emitted[0].payload)).to.not.include('secret')
  })

  it('emits a stable dedup key for repeated identical slow requests and emits nothing under target', async function () {
    const emitted = []
    const slow = async () => {
      await sleep(30)
      return { data_view_results: [{ pid: 'x' }], data_view_metadata: {} }
    }
    const fast = async () => ({
      data_view_results: [{ pid: 'x' }],
      data_view_metadata: {}
    })

    await execute_data_view_request({
      request_id: 'v',
      params: sample_params(),
      user_id: null,
      path: 'socket',
      cache_key: 'k-slow',
      run_query: slow,
      signal_emitter: async (args) => emitted.push(args),
      cache_get: async () => null,
      emission_threshold_ms: 10
    })
    await execute_data_view_request({
      request_id: 'v',
      params: sample_params(),
      user_id: null,
      path: 'socket',
      cache_key: 'k-slow',
      run_query: slow,
      signal_emitter: async (args) => emitted.push(args),
      cache_get: async () => null,
      emission_threshold_ms: 10
    })

    expect(emitted.length).to.equal(2)
    expect(emitted[0].kind).to.equal('slow_query')
    expect(emitted[0].payload.query_group).to.equal('data_view')
    expect(emitted[0].dedup_key).to.equal(emitted[1].dedup_key)

    // Under target the executor is SILENT -- it does not emit, and (since the
    // self-resolve arm was removed) it does not close the open key either.
    // slow_query is registered `event`; closure is triage-owned. Asserting the
    // count is unchanged rather than merely "no new emit" is what would catch a
    // reintroduced auto-close arm smuggling a resolution in on this path.
    const emitted_before_fast = emitted.length
    await execute_data_view_request({
      request_id: 'v',
      params: sample_params(),
      user_id: null,
      path: 'socket',
      cache_key: 'k-fast',
      run_query: fast,
      signal_emitter: async (args) => emitted.push(args),
      cache_get: async () => null,
      emission_threshold_ms: 100
    })

    expect(emitted.length).to.equal(emitted_before_fast)
  })

  it('holds an accepted slow query silent under its ceiling and still emits above it', async function () {
    const slow = async () => {
      await sleep(30)
      return { data_view_results: [{ pid: 'x' }], data_view_metadata: {} }
    }

    // Learn the signature from a real emission rather than hardcoding the hash,
    // so this stays anchored to what the executor actually computes.
    const discovered = []
    await execute_data_view_request({
      request_id: 'v',
      params: sample_params(),
      user_id: null,
      path: 'socket',
      cache_key: 'k-accept-discover',
      run_query: slow,
      signal_emitter: async (args) => discovered.push(args),
      cache_get: async () => null,
      emission_threshold_ms: 10
    })
    expect(discovered.length).to.equal(1)
    const signature = discovered[0].payload.signature
    expect(signature, 'signature travels on the payload').to.be.a('string')

    // Accepted at a ceiling this run cannot reach: silent.
    const under = []
    await execute_data_view_request({
      request_id: 'v',
      params: sample_params(),
      user_id: null,
      path: 'socket',
      cache_key: 'k-accept-under',
      run_query: slow,
      signal_emitter: async (args) => under.push(args),
      cache_get: async () => null,
      emission_threshold_ms: 10,
      accepted_slow_queries: { [signature]: { threshold_ms: 100000 } }
    })
    expect(under.length).to.equal(0)

    // The negative control that makes the assertion above non-vacuous: the SAME
    // accepted signature, a ceiling this run does clear, and the signal comes
    // back. Acceptance is a raised threshold, never a mute -- without this case
    // a registry that suppressed everything unconditionally would pass.
    const over = []
    await execute_data_view_request({
      request_id: 'v',
      params: sample_params(),
      user_id: null,
      path: 'socket',
      cache_key: 'k-accept-over',
      run_query: slow,
      signal_emitter: async (args) => over.push(args),
      cache_get: async () => null,
      emission_threshold_ms: 100000,
      accepted_slow_queries: { [signature]: { threshold_ms: 10 } }
    })
    expect(over.length).to.equal(1)
    expect(over[0].payload.signature).to.equal(signature)
  })

  it('lapses an acceptance when the query shape changes', async function () {
    const slow = async () => {
      await sleep(30)
      return { data_view_results: [{ pid: 'x' }], data_view_metadata: {} }
    }
    // An acceptance is keyed by query SHAPE. A view carrying a different column
    // hashes differently, so the entry stops matching and the default threshold
    // governs again -- a narrowed view has to re-earn its acceptance.
    const other_params = () => ({
      ...sample_params(),
      columns: [{ column_id: 'player_targets', params: { year: [2023] } }]
    })

    const discovered = []
    await execute_data_view_request({
      request_id: 'v',
      params: sample_params(),
      user_id: null,
      path: 'socket',
      cache_key: 'k-lapse-discover',
      run_query: slow,
      signal_emitter: async (args) => discovered.push(args),
      cache_get: async () => null,
      emission_threshold_ms: 10
    })
    const accepted_signature = discovered[0].payload.signature

    const emitted = []
    await execute_data_view_request({
      request_id: 'v',
      params: other_params(),
      user_id: null,
      path: 'socket',
      cache_key: 'k-lapse',
      run_query: slow,
      signal_emitter: async (args) => emitted.push(args),
      cache_get: async () => null,
      emission_threshold_ms: 10,
      accepted_slow_queries: { [accepted_signature]: { threshold_ms: 100000 } }
    })

    expect(emitted.length).to.equal(1)
    expect(emitted[0].payload.signature).to.not.equal(accepted_signature)
  })

  it('re-checks the cache at admission and returns it without executing', async function () {
    let executed = false
    const result = await execute_data_view_request({
      request_id: 'v',
      params: sample_params(),
      user_id: null,
      path: 'socket',
      cache_key: 'k-cached',
      run_query: async () => {
        executed = true
        throw new Error('must not execute')
      },
      cache_get: async () => ({
        data_view_results: [{ pid: 'cached' }],
        data_view_metadata: {}
      })
    })

    expect(executed).to.equal(false)
    expect(result.cache_hit).to.equal(true)
    expect(result.data_view_results).to.deep.equal([{ pid: 'cached' }])
  })

  it('keeps execution as a single multi-statement db.raw (no transaction wrapper)', function () {
    // The executor must never wrap execution in db.transaction: the SET LOCALs
    // and the SELECT ship as one multi-statement db.raw, and a client round-trip
    // between them would let idle_in_transaction_session_timeout kill the query.
    const source = fs.readFileSync(executor_path, 'utf8')
    expect(source).to.not.match(/transaction\s*\(/)
    expect(source).to.include('multi-statement')
  })

  it('mints execution_id at request entry so a cache-hit result carries it', async function () {
    const ws = make_ws()
    await handle_data_view_request({
      ws,
      user_id: null,
      request_id: 'view-1',
      params: sample_params(),
      ignore_cache: false,
      cache_get: async () => ({
        data_view_results: [{ pid: 'cached' }],
        data_view_metadata: {}
      })
    })

    const result_frame = ws.sent.find(
      (message) => message.type === 'DATA_VIEW_RESULT'
    )
    expect(result_frame, 'a DATA_VIEW_RESULT was sent').to.exist
    expect(result_frame.payload.execution_id).to.be.a('string')
    expect(result_frame.payload.execution_id.length).to.be.above(0)

    // The timing frame for that same execution must be accepted and clamped.
    const entry = handle_client_timing({
      ws,
      payload: {
        request_id: 'view-1',
        execution_id: result_frame.payload.execution_id,
        client_duration_ms: 1e12,
        outcome: 'result'
      }
    })
    expect(entry).to.exist
    expect(entry.client_duration_ms).to.equal(3600 * 1000)
    expect(entry.client_reported).to.equal(true)
  })

  it('drops a client timing frame for an execution it never minted', function () {
    const ws = make_ws()
    const entry = handle_client_timing({
      ws,
      payload: {
        request_id: 'view-1',
        execution_id: 'forged-execution-id',
        client_duration_ms: 500,
        outcome: 'result'
      }
    })
    expect(entry).to.equal(null)
  })
})
