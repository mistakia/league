import crypto from 'crypto'
import { get_data_view_results, redis_cache, emit_signal } from '#libs-server'

// The single entry every path that executes a data-view query calls. Holds both
// the bounded-concurrency admission gate and the telemetry/signal
// instrumentation, so admission and timeout policy cannot diverge across the
// four call sites again.
//
// Cap derived from measurement on 2026-08-19 (see
// user:task/league/data-views/tune-data-view-request-queue.md): the heaviest
// organic data-view shape (a wide dynasty view, ~4.4s, CPU-bound, no temp
// spill) degrades median query duration 24% at N=2 and >66% at N=4 against N=1,
// and each concurrent data-view query holds one of the 20-connection knex pool,
// so N=2 sits well below pool max and cannot starve auth/roster reads. The
// Postgres blast-radius backstops (temp_file_limit, idle_in_transaction_session_timeout)
// land in the same change.
const DATA_VIEW_MAX_CONCURRENT_QUERIES = 2
const DATA_VIEW_HEARTBEAT_INTERVAL_MS = 2000
// The 5s target IS the emission threshold (operator ruling 2026-08-19), never a
// cutoff. Severity tiers are sized off the real distribution (current-log p50
// 5.1s / p90 8.2s / max 13.8s; organic tail 22-34s), not the refuted 31.8s
// jit-investigation artifact.
const DATA_VIEW_EMISSION_THRESHOLD_MS = 5000
const DATA_VIEW_SIGNED_IN_TIMEOUT_MS = 5 * 60 * 1000
const DATA_VIEW_SIGNED_OUT_TIMEOUT_MS = 40 * 1000

const SEVERITY_TIERS = [
  { min_ms: 120000, severity: 'critical' },
  { min_ms: 60000, severity: 'high' },
  { min_ms: 10000, severity: 'medium' },
  { min_ms: DATA_VIEW_EMISSION_THRESHOLD_MS, severity: 'low' }
]

// Counting-semaphore state over module scope: one gate shared by every path,
// not a class. `waiting` holds the FIFO of waiter handles; release passes the
// slot to the head waiter rather than decrementing, so the counter never drifts
// under concurrent release.
const admission = {
  active_request_count: 0,
  waiting: [],
  counters: {
    arrivals: 0,
    admitted: 0,
    completed: 0,
    failed: 0,
    superseded_waiters: 0,
    discarded_results: 0,
    cache_hits: 0,
    signals_emitted: 0
  }
}

export const get_admission_state = () => ({
  active_request_count: admission.active_request_count,
  waiting_request_count: admission.waiting.length,
  max_concurrent_queries: DATA_VIEW_MAX_CONCURRENT_QUERIES,
  heartbeat_interval_ms: DATA_VIEW_HEARTBEAT_INTERVAL_MS,
  counters: { ...admission.counters }
})

// Test seam: zeroes the gate so a spec can assert deltas rather than
// accumulating counters. Not part of the runtime contract.
export const reset_admission_state = () => {
  admission.active_request_count = 0
  admission.waiting = []
  admission.counters.arrivals = 0
  admission.counters.admitted = 0
  admission.counters.completed = 0
  admission.counters.failed = 0
  admission.counters.superseded_waiters = 0
  admission.counters.discarded_results = 0
  admission.counters.cache_hits = 0
  admission.counters.signals_emitted = 0
}

const mint_execution_id = () => crypto.randomBytes(8).toString('hex')

// Stable query-SHAPE signature for the slow-query dedup key. Deliberately NOT
// get_data_view_hash, which folds in where/sort/offset/viewer -- that is correct
// for a cache key and wrong for a work-queue key, because it would split one
// tunable condition across every pagination offset and every filter. Signature
// is the ordered column ids plus their params plus the row axes, so a view
// paging through offsets or filtering differently still collapses to one signal.
const data_view_query_signature = (params) => {
  const { columns = [], row_axes = [] } = params || {}
  const canonical = JSON.stringify({
    row_axes,
    columns: (columns || []).map((col) => {
      const { column_id, params: col_params = {} } = col || {}
      const sorted_params = Object.keys(col_params)
        .sort()
        .reduce((acc, k) => {
          acc[k] = col_params[k]
          return acc
        }, {})
      return { column_id, params: sorted_params }
    })
  })
  return crypto
    .createHash('sha256')
    .update(canonical)
    .digest('hex')
    .slice(0, 16)
}

// Accepted slow queries -- shapes that were measured, diagnosed, and knowingly
// left slow because the only remaining fix costs something we declined to pay.
//
// An entry RAISES this signature's emission threshold to its accepted ceiling.
// It is not a mute: a run above the ceiling still emits, because "known to cost
// 6.6s" and "degraded to 14s" are different facts and only the second wants
// triage.
//
// Acceptance lapses on its own. The signature is derived from query SHAPE, so
// editing the view changes the hash, the entry stops matching, and the shape
// reports again until someone re-accepts it. That is the intended direction of
// failure -- a narrowed view should have to re-earn its acceptance rather than
// inherit one made about a different query.
//
// Every entry states the trade-off that was declined, so a reader sees which
// fix was available and why it was not taken. `review_after` exists so an
// accepted cost gets revisited instead of inherited forever.
const ACCEPTED_SLOW_QUERIES = {
  da81f8407752c611: {
    threshold_ms: 8000,
    measured_ms: 6593,
    accepted_at: '2026-08-23',
    review_after: '2027-02-23',
    signal_id: 126506,
    reason:
      'Wide 7-year player-year view: 23 outer joins, 7 CTEs, seven nfl_plays ' +
      'partition index scans at 136-190ms each. No dominant node, no ' +
      'misestimate, every scan index-driven, largest single leaf under 200ms ' +
      '-- there is no index or query rewrite left to make. The only remaining ' +
      'fix is narrowing the view (fewer columns or a shorter year range), a ' +
      'product decision we declined. 8000 deliberately does NOT cover the ' +
      'loaded case: this class of query measured 4,992ms idle against ' +
      '10,840ms under load, so a contended run still emits, which is the ' +
      'run worth looking at.'
  }
}

// An accepted ceiling wins over an explicitly passed emission_threshold_ms.
// Acceptance is a standing policy statement about one query shape; the
// parameter is a per-call seam. Ordering them this way means no caller can
// un-accept a shape by passing a threshold, and callers that pass one still get
// it for every shape carrying no entry.
const effective_threshold_ms = ({
  signature,
  emission_threshold_ms,
  accepted_slow_queries = ACCEPTED_SLOW_QUERIES
}) => {
  const accepted = accepted_slow_queries[signature]
  return accepted ? accepted.threshold_ms : emission_threshold_ms
}

const severity_for_total_ms = (total_ms, threshold_ms) => {
  const tiers =
    threshold_ms === DATA_VIEW_EMISSION_THRESHOLD_MS
      ? SEVERITY_TIERS
      : SEVERITY_TIERS.map((tier) =>
          tier.severity === 'low' ? { ...tier, min_ms: threshold_ms } : tier
        )
  for (const tier of tiers) {
    if (total_ms >= tier.min_ms) return tier.severity
  }
  return null
}

// Structured console.log JSONL -- the distribution carrier (p50/p95/trend) that
// the signal queue cannot hold. Per league CLAUDE.md, anything whose log is its
// audit trail uses console.log/console.error, never debug (the deployed server
// sets no DEBUG at all). The client-timing handler logs a second line type,
// joined on execution_id.
export const log_data_view_telemetry = (entry) => {
  console.log(`data-view-telemetry: ${JSON.stringify(entry)}`)
}

// Emits a slow_query signal for a data-view execution past the threshold.
// Fire-and-forget: emit_signal returns null on every failure path rather than
// throwing.
//
// There is deliberately NO auto-resolve arm. It lived here until it was found to
// be unreachable in the case that mattered -- this function is only called on the
// cache-MISS path, after a 12-hour result cache write, so a slow shape emitted
// once and every repeat inside that window was a cache hit that returned early
// and never reported at all. Worse, where it did fire it closed with a hardcoded
// `[Fix]` note, and a shape crossing back under threshold is not evidence of a
// fix: the same production query measured 4,992ms idle and 10,840ms under load.
// slow_query is registered `event` accordingly; closure is triage-owned.
const report_slow_query = ({
  params,
  path,
  total_ms,
  admission_wait_duration_ms,
  query_execution_duration_ms,
  result_row_count,
  user_id,
  started_at,
  signal_emitter = emit_signal,
  emission_threshold_ms = DATA_VIEW_EMISSION_THRESHOLD_MS,
  accepted_slow_queries = ACCEPTED_SLOW_QUERIES
}) => {
  const signature = data_view_query_signature(params)
  const dedup_key = `slow_query:data_view:${signature}`
  const severity = severity_for_total_ms(
    total_ms,
    effective_threshold_ms({
      signature,
      emission_threshold_ms,
      accepted_slow_queries
    })
  )

  if (!severity) return

  admission.counters.signals_emitted++
  signal_emitter({
    source: 'libs-server/data-views/execute-data-view-request.mjs',
    kind: 'slow_query',
    severity,
    title: `Slow data-view query ${total_ms}ms via ${path}`,
    payload: {
      query_group: 'data_view',
      signature,
      path,
      admission_wait_duration_ms,
      query_execution_duration_ms,
      total_ms,
      result_row_count,
      user_id: user_id || null,
      started_at
    },
    dedup_key,
    forensic_link: `postgres-log@${started_at}`
  })
}

// Acquires a slot, abortable while waiting. The abort path is how a disconnect
// or a superseding request from the same client cancels a request that has not
// yet started executing.
const acquire_slot = (signal) => {
  admission.counters.arrivals++
  if (admission.active_request_count < DATA_VIEW_MAX_CONCURRENT_QUERIES) {
    admission.active_request_count++
    admission.counters.admitted++
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const waiter = {
      // The waiter's resolve TAKES the slot (increments active count), and the
      // releaser passes it by resolving the head waiter rather than by
      // decrementing, so exactly one slot moves per release.
      resolve: () => {
        admission.active_request_count++
        admission.counters.admitted++
        resolve()
      },
      reject
    }
    admission.waiting.push(waiter)
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          const index = admission.waiting.indexOf(waiter)
          if (index !== -1) {
            admission.waiting.splice(index, 1)
            admission.counters.superseded_waiters++
          }
          reject(
            Object.assign(new Error('request superseded'), { code: 'ABORTED' })
          )
        },
        { once: true }
      )
    }
  })
}

const release_slot = () => {
  const next = admission.waiting.shift()
  if (next) next.resolve()
  else admission.active_request_count--
}

/**
 * Execute one data-view query through the shared admission gate.
 *
 * @param {object} opts
 * @param {string} opts.request_id - the client's VIEW id (not a per-request identity)
 * @param {string} [opts.execution_id] - server-minted per-execution id; the socket
 *   mints it at request entry so cache-hit results carry one too; REST callers omit
 *   it and the executor mints one.
 * @param {object} opts.params - the table state
 * @param {number|null} opts.user_id
 * @param {string} opts.path - 'socket' | 'search' | 'debug' | 'export'
 * @param {string} opts.cache_key - the redis key the caller already computed
 * @param {AbortSignal} [opts.signal] - abort while waiting (disconnect / supersede)
 * @param {(state: 'waiting'|'executing') => boolean} [opts.on_heartbeat] - called
 *   every interval while queued or in flight; return false (socket closed) to stop.
 * @param {(info: object) => void} [opts.on_status] - called once when execution starts.
 * @param {(opts: object) => Promise<{ data_view_results: object, data_view_metadata: object }>} [opts.run_query] - execution seam (defaults to get_data_view_results)
 * @param {(opts: object) => void} [opts.signal_emitter] - seam for the slow-query emitter
 * @param {(key: string) => Promise<object|null>} [opts.cache_get] - seam for the admission cache re-check
 * @param {boolean} [opts.skip_cache] - bypass the admission re-check and cache
 *   write (the /debug route must keep its bypass-cache contract)
 * @param {number} [opts.heartbeat_interval_ms] - seam for a short interval in tests
 * @param {number} [opts.emission_threshold_ms] - seam for the 5s emission threshold
 * @param {object} [opts.accepted_slow_queries] - seam for the accepted-cost registry
 */
export async function execute_data_view_request({
  request_id,
  execution_id,
  params,
  user_id,
  path,
  cache_key,
  signal,
  on_heartbeat,
  on_status,
  run_query = get_data_view_results,
  signal_emitter = emit_signal,
  cache_get = (key) => redis_cache.get(key),
  skip_cache = false,
  heartbeat_interval_ms = DATA_VIEW_HEARTBEAT_INTERVAL_MS,
  emission_threshold_ms = DATA_VIEW_EMISSION_THRESHOLD_MS,
  accepted_slow_queries = ACCEPTED_SLOW_QUERIES
}) {
  const exec_id = execution_id || mint_execution_id()
  const request_started_at = Date.now()
  const started_at = new Date(request_started_at).toISOString()
  const timeout = user_id
    ? DATA_VIEW_SIGNED_IN_TIMEOUT_MS
    : DATA_VIEW_SIGNED_OUT_TIMEOUT_MS
  const is_pagination_request = params.offset > 0 && params.append_results
  const calculate_total_count = !is_pagination_request

  // Heartbeat covers the WHOLE in-flight window (queue wait + execution), which
  // is what makes a client silence budget a small multiple of one interval and
  // independent of every server timeout. Cache hits are answered before this
  // function runs (and re-checked at admission), so they never need one.
  let heartbeat_timer = null
  if (on_heartbeat) {
    const beat = () => {
      const delivered = on_heartbeat({
        request_id,
        execution_id: exec_id,
        state
      })
      if (delivered === false && heartbeat_timer) {
        clearInterval(heartbeat_timer)
        heartbeat_timer = null
      }
    }
    heartbeat_timer = setInterval(beat, heartbeat_interval_ms)
  }
  // The abort also stops the heartbeat: a superseded or disconnected request
  // must not keep signalling a client that has moved on.
  const stop_heartbeat = () => {
    if (heartbeat_timer) {
      clearInterval(heartbeat_timer)
      heartbeat_timer = null
    }
  }
  if (signal) signal.addEventListener('abort', stop_heartbeat, { once: true })

  let state = 'waiting'
  let acquired = false
  try {
    await acquire_slot(signal)
    acquired = true

    // Re-check the cache at admission: a concurrent execution of the same view
    // may have populated it while this request waited, so a same-view duplicate
    // returns the finished first execution's rows instead of re-running. The
    // /debug route and ignore_cache exports pass skip_cache to bypass this.
    const cached = skip_cache ? null : await cache_get(cache_key)
    if (cached) {
      admission.counters.cache_hits++
      admission.counters.completed++
      const normalized = Array.isArray(cached)
        ? { data_view_results: cached, data_view_metadata: {} }
        : cached
      const admission_wait_duration_ms = Date.now() - request_started_at
      log_data_view_telemetry({
        event: 'execution',
        execution_id: exec_id,
        request_id,
        path,
        outcome: 'cache_hit',
        admission_wait_duration_ms,
        query_execution_duration_ms: 0,
        result_row_count: (normalized.data_view_results || []).length,
        user_id: user_id ? 'signed-in' : 'anonymous'
      })
      return {
        data_view_results: normalized.data_view_results,
        data_view_metadata: normalized.data_view_metadata,
        execution_id: exec_id,
        admission_wait_duration_ms,
        query_execution_duration_ms: 0,
        result_row_count: (normalized.data_view_results || []).length,
        cache_hit: true
      }
    }

    state = 'executing'
    if (on_status) {
      on_status({ request_id, execution_id: exec_id, status: 'processing' })
    }
    if (on_heartbeat) {
      on_heartbeat({ request_id, execution_id: exec_id, state })
    }
    const query_started_at = Date.now()

    // One multi-statement db.raw per slot (inside get_data_view_results). Never
    // wrap in db.transaction: the SET LOCALs and the SELECT must ship as a
    // single simple-query message with no client round-trip between them, or
    // idle_in_transaction_session_timeout could kill a running query mid-batch.
    const { data_view_results, data_view_metadata } = await run_query({
      ...params,
      calculate_total_count,
      // Timeout after the spread: the client's table state must not be able to
      // name its own deadline. `timeout` reaches Postgres as SET LOCAL
      // statement_timeout verbatim.
      timeout,
      user_id: user_id || null
    })

    const query_execution_duration_ms = Date.now() - query_started_at
    const admission_wait_duration_ms = query_started_at - request_started_at
    const total_ms = Date.now() - request_started_at
    const result_row_count = (data_view_results || []).length

    if (!skip_cache && data_view_results && data_view_results.length) {
      const cache_ttl = data_view_metadata.cache_ttl || 1000 * 60 * 60 * 12 // 12 hours (ms)
      await redis_cache.set(
        cache_key,
        { data_view_results, data_view_metadata },
        Math.round(cache_ttl / 1000)
      )
      if (data_view_metadata.cache_expire_at) {
        await redis_cache.expire_at(
          cache_key,
          data_view_metadata.cache_expire_at
        )
      }
    }

    report_slow_query({
      params,
      path,
      total_ms,
      admission_wait_duration_ms,
      query_execution_duration_ms,
      result_row_count,
      user_id,
      started_at,
      signal_emitter,
      emission_threshold_ms,
      accepted_slow_queries
    })

    // Telemetry reads emitted_signal off the SAME effective threshold the
    // emitter used, so an accepted shape reports false here rather than
    // claiming a signal that was never sent.
    const execution_signature = data_view_query_signature(params)

    admission.counters.completed++
    log_data_view_telemetry({
      event: 'execution',
      execution_id: exec_id,
      request_id,
      path,
      outcome:
        data_view_results && data_view_results.length ? 'result' : 'empty',
      admission_wait_duration_ms,
      query_execution_duration_ms,
      total_ms,
      result_row_count,
      signature: execution_signature,
      emitted_signal: Boolean(
        severity_for_total_ms(
          total_ms,
          effective_threshold_ms({
            signature: execution_signature,
            emission_threshold_ms,
            accepted_slow_queries
          })
        )
      ),
      user_id: user_id ? 'signed-in' : 'anonymous'
    })

    return {
      data_view_results,
      data_view_metadata,
      execution_id: exec_id,
      admission_wait_duration_ms,
      query_execution_duration_ms,
      result_row_count,
      cache_hit: false
    }
  } catch (error) {
    admission.counters.failed++
    throw error
  } finally {
    stop_heartbeat()
    if (signal) signal.removeEventListener('abort', stop_heartbeat)
    if (acquired) release_slot()
  }
}
