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
    const controller = new AbortController()
    const holder = execute_data_view_request({
      request_id: 'v1',
      params: sample_params(),
      user_id: null,
      path: 'socket',
      cache_key: 'k-holder',
      run_query: async () => {
        await sleep(150)
        return empty_result()
      },
      cache_get: async () => null
    })
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
    await holder
    expect(executed).to.equal(false)
    expect(get_admission_state().active_request_count).to.equal(0)
  })

  it('fires a heartbeat while a request is still waiting for a slot', async function () {
    const heartbeats = []
    const holder = execute_data_view_request({
      request_id: 'v1',
      params: sample_params(),
      user_id: null,
      path: 'socket',
      cache_key: 'k-holder',
      run_query: async () => {
        await sleep(120)
        return empty_result()
      },
      cache_get: async () => null
    })
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
    await holder

    expect(heartbeats, 'heartbeat fired during queue wait').to.include(
      'waiting'
    )
    expect(heartbeats, 'heartbeat fired during execution').to.include(
      'executing'
    )
  })

  it('emits a stable dedup key for repeated identical slow requests and resolves it on recovery', async function () {
    const emitted = []
    const resolved = []
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
      signal_resolver: async (args) => resolved.push(args),
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
      signal_resolver: async (args) => resolved.push(args),
      cache_get: async () => null,
      emission_threshold_ms: 10
    })

    expect(emitted.length).to.equal(2)
    expect(emitted[0].kind).to.equal('slow_query')
    expect(emitted[0].payload.query_group).to.equal('data_view')
    expect(emitted[0].dedup_key).to.equal(emitted[1].dedup_key)

    // Recovery: the same signature landing under target resolves the open key.
    await execute_data_view_request({
      request_id: 'v',
      params: sample_params(),
      user_id: null,
      path: 'socket',
      cache_key: 'k-fast',
      run_query: fast,
      signal_emitter: async (args) => emitted.push(args),
      signal_resolver: async (args) => resolved.push(args),
      cache_get: async () => null,
      emission_threshold_ms: 100
    })

    expect(resolved.length).to.equal(1)
    expect(resolved[0].dedup_key).to.equal(emitted[0].dedup_key)
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
