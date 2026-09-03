import crypto from 'crypto'
import { get_data_view_results, redis_cache, emit_signal } from '#libs-server'
import { DATA_VIEW_DEFAULT_MAX_LIMIT } from '#libs-server/validators.mjs'
import run_query_backed_view from '#libs-server/data-views/run-query-backed-view.mjs'

// The single entry every path that executes a data-view query calls. Holds both
// the bounded-concurrency admission gate and the telemetry/signal
// instrumentation, so admission and timeout policy cannot diverge across the
// four call sites again. The gate is two-class -- interactive and bulk -- but
// both classes are admitted here, from one budget, for the same reason.
//
// Cap derived from measurement on 2026-08-19 (see
// user:task/league/data-views/tune-data-view-request-queue.md): the heaviest
// organic data-view shape (a wide dynasty view, ~4.4s, CPU-bound, no temp
// spill) degrades median query duration 24% at N=2 and >66% at N=4 against N=1,
// and each concurrent data-view query holds one of the 20-connection knex pool,
// so N=2 sits well below pool max and cannot starve auth/roster reads. The
// Postgres blast-radius backstops (temp_file_limit, idle_in_transaction_session_timeout)
// land in the same change.
//
// This TOTAL is unchanged by the bulk split below and must stay that way
// without a fresh measurement: the 24%/66% figures are readings at N=2 and
// N=4, and nothing has measured N=3. The split partitions the same two slots,
// it does not add a third.
const DATA_VIEW_MAX_CONCURRENT_QUERIES = 2
// Sub-cap on the bulk class WITHIN the total above, so at least one slot is
// always reachable by an interactive request. This exists because bulk and
// interactive have incomparable deadlines sharing one counter: the export route
// raises statement_timeout to 30 minutes for an API-key holder, so before the
// split two concurrent exports could hold both slots for half an hour while
// every browser table queued behind them. Measured on 2026-09-03: admission
// wait is p50 1ms / p90 3ms across 449 cache-miss executions but has a maximum
// of 91,623ms -- 91 seconds of pure queueing, against a continuous stream of
// `SET LOCAL statement_timeout = 1800000` backends in pg_stat_activity.
//
// What the sub-cap guarantees is a BOUND, not a zero: an interactive request
// can still wait behind other interactive requests on the remaining slot, but
// its wait is now a multiple of an interactive query (seconds) instead of a
// bulk export's timeout (up to 30 minutes). Raising this to 2 restores exactly
// the starvation it was added to remove.
const DATA_VIEW_MAX_CONCURRENT_BULK_QUERIES = 1
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

// The two admission classes. Bulk is the class whose deadline is a caller's
// batch job rather than a person watching a table redraw, and membership is
// decided HERE from `path` rather than passed by each call site -- same reason
// the executor resolves run_query and the timeout itself, since a per-call-site
// classification is a classification somebody forgets.
//
// Only the export route is bulk. `agent-preview` is deliberately interactive:
// it is row-capped, short, and a live generation session is waiting on it, so
// it belongs with the socket rather than behind a 30-minute export.
const ADMISSION_CLASS_INTERACTIVE = 'interactive'
const ADMISSION_CLASS_BULK = 'bulk'
const BULK_ADMISSION_PATHS = new Set(['export'])

const admission_class_for_path = (path) =>
  BULK_ADMISSION_PATHS.has(path)
    ? ADMISSION_CLASS_BULK
    : ADMISSION_CLASS_INTERACTIVE

// Counting-semaphore state over module scope: one gate shared by every path,
// not a class, holding a total budget plus a bulk sub-budget. `waiting` holds a
// FIFO of waiter handles PER class; release decrements and then re-pumps both
// queues in one synchronous step, so the counter never drifts and a slot freed
// by a bulk request can go to an interactive waiter (which a
// pass-the-slot-to-my-own-head-waiter release could not do).
const admission = {
  active: { interactive: 0, bulk: 0 },
  waiting: { interactive: [], bulk: [] },
  counters: {
    arrivals: 0,
    admitted: 0,
    interactive_admitted: 0,
    bulk_admitted: 0,
    completed: 0,
    failed: 0,
    superseded_waiters: 0,
    discarded_results: 0,
    cache_hits: 0,
    signals_emitted: 0
  }
}

const active_total = () => admission.active.interactive + admission.active.bulk
const waiting_total = () =>
  admission.waiting.interactive.length + admission.waiting.bulk.length

export const get_admission_state = () => ({
  active_request_count: active_total(),
  waiting_request_count: waiting_total(),
  max_concurrent_queries: DATA_VIEW_MAX_CONCURRENT_QUERIES,
  max_concurrent_bulk_queries: DATA_VIEW_MAX_CONCURRENT_BULK_QUERIES,
  interactive: {
    active_request_count: admission.active.interactive,
    waiting_request_count: admission.waiting.interactive.length
  },
  bulk: {
    active_request_count: admission.active.bulk,
    waiting_request_count: admission.waiting.bulk.length
  },
  heartbeat_interval_ms: DATA_VIEW_HEARTBEAT_INTERVAL_MS,
  counters: { ...admission.counters }
})

// Test seam: zeroes the gate so a spec can assert deltas rather than
// accumulating counters. Not part of the runtime contract.
export const reset_admission_state = () => {
  admission.active.interactive = 0
  admission.active.bulk = 0
  admission.waiting.interactive = []
  admission.waiting.bulk = []
  for (const key of Object.keys(admission.counters)) {
    admission.counters[key] = 0
  }
}

const mint_execution_id = () => crypto.randomBytes(8).toString('hex')

// Stable query-SHAPE signature for the slow-query dedup key. Deliberately NOT
// get_data_view_hash, which folds in where/sort/offset/viewer -- that is correct
// for a cache key and wrong for a work-queue key, because it would split one
// tunable condition across every pagination offset and every filter. Signature
// is the ordered column ids plus their params plus the row axes, so a view
// paging through offsets or filtering differently still collapses to one signal.
//
// A sandboxed-SQL request carries NEITHER columns nor row_axes, so without the
// branch below every SQL view in existence collapses to one signature and one
// dedup key -- and all but the first slow SQL query is suppressed as a duplicate
// of an unrelated one. The statement IS the shape for that path.
const data_view_query_signature = (params) => {
  const { sql_text, query_id } = params || {}
  if (sql_text || query_id) {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify({ query_id: query_id || null, sql_text }))
      .digest('hex')
      .slice(0, 16)
  }

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
// fix was available and why it was not taken.
//
// `review_after` is a NOTE TO A READER, not a trigger. Nothing in this repo
// reads it -- there is no job, lint or signal that fires when the date passes,
// and a session that assumes otherwise is trusting a safety net that does not
// exist. It records that an acceptance was meant to last months rather than
// forever. The two mechanisms that DO operate are the two above: a run past the
// ceiling still emits, and editing the view changes the signature so the
// acceptance stops matching. Between them, the exposure from never revisiting
// an entry is that a query known to cost its measured_ms keeps costing it.
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
      'loaded case, so a contended run still emits, which is the run worth ' +
      'looking at. The idle-vs-loaded factor here was originally recorded as ' +
      '4,992ms against 10,840ms (2.17x) under conditions nobody characterised. ' +
      'Re-measured 2026-08-30 on interleaved arms it is 4,836ms quiet (load ' +
      '2.1-2.8) against 6,123ms loaded (load 7.5-8.1) -- 1.27x, not 2.17x. Do ' +
      'not project a quiet-host number off the old figure: the query is on-CPU ' +
      '91-94% of its elapsed time, so contention costs lost PARALLELISM (7-11 ' +
      'of 17 planned workers launch under load, 11-14 quiet) rather than wait, ' +
      'and roughly 6.1 CPU-seconds is computation no host quieting removes. ' +
      'Note 6593 is itself a loaded reading, and 4,836ms quiet leaves only ' +
      '~160ms under the 5s objective while the view span grows a season a ' +
      'year, so this acceptance is more marginal than the ceiling suggests.'
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

// A class may enter only while the TOTAL budget has room, and bulk additionally
// only while the bulk sub-budget has room. The second clause is what keeps a
// slot reachable by interactive traffic no matter how many exports are in
// flight.
const can_admit = (admission_class) => {
  if (active_total() >= DATA_VIEW_MAX_CONCURRENT_QUERIES) return false
  if (
    admission_class === ADMISSION_CLASS_BULK &&
    admission.active.bulk >= DATA_VIEW_MAX_CONCURRENT_BULK_QUERIES
  ) {
    return false
  }
  return true
}

const take_slot = (admission_class) => {
  admission.active[admission_class]++
  admission.counters.admitted++
  admission.counters[`${admission_class}_admitted`]++
}

// Interactive waiters are drained before bulk waiters, so a freed slot goes to
// the class that has someone waiting on it. Bulk does not starve in return: it
// is capped, not deprioritised out of existence -- an in-flight export keeps its
// slot for its whole run, and interactive arrivals are sparse (p50 admission
// wait 1ms) so the interactive queue is empty nearly always.
const pump_waiters = () => {
  for (const admission_class of [
    ADMISSION_CLASS_INTERACTIVE,
    ADMISSION_CLASS_BULK
  ]) {
    const queue = admission.waiting[admission_class]
    while (queue.length && can_admit(admission_class)) {
      const waiter = queue.shift()
      take_slot(admission_class)
      waiter.resolve()
    }
  }
}

// Acquires a slot in the caller's class, abortable while waiting. The abort path
// is how a disconnect or a superseding request from the same client cancels a
// request that has not yet started executing.
const acquire_slot = (signal, admission_class) => {
  admission.counters.arrivals++
  if (can_admit(admission_class)) {
    take_slot(admission_class)
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const queue = admission.waiting[admission_class]
    const waiter = { resolve, reject }
    queue.push(waiter)
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          const index = queue.indexOf(waiter)
          if (index !== -1) {
            queue.splice(index, 1)
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

// The decrement and the re-pump are one synchronous step with no await between
// them, so the counters cannot drift and no request observes the gate mid-move.
const release_slot = (admission_class) => {
  admission.active[admission_class]--
  pump_waiters()
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
 * @param {string} opts.path - 'socket' | 'search' | 'debug' | 'export' | 'sql'.
 *   Also decides the admission class: 'export' is bulk, everything else is
 *   interactive.
 * @param {string} opts.cache_key - the redis key the caller already computed
 * @param {number|null} [opts.max_limit] - server-resolved ceiling on the table
 *   state's limit; null for no ceiling (export API key only)
 * @param {number|null} [opts.timeout_ms] - server-resolved statement_timeout
 *   override; null keeps the signed-in / signed-out default
 * @param {AbortSignal} [opts.signal] - abort while waiting (disconnect / supersede)
 * @param {(state: 'waiting'|'executing') => boolean} [opts.on_heartbeat] - called
 *   every interval while queued or in flight; return false (socket closed) to stop.
 * @param {(info: object) => void} [opts.on_status] - called once when execution starts.
 * @param {(opts: object) => Promise<{ data_view_results: object, data_view_metadata: object, data_view_fields?: Array<object> }>} [opts.run_query] - execution seam. Left unset it resolves per request: run_query_backed_view when params carry a query_id, get_data_view_results otherwise. The SQL tiers enter here as an alternate run_query rather than as a fifth execution path.
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
  max_limit = DATA_VIEW_DEFAULT_MAX_LIMIT,
  timeout_ms = null,
  run_query = null,
  signal_emitter = emit_signal,
  cache_get = (key) => redis_cache.get(key),
  skip_cache = false,
  heartbeat_interval_ms = DATA_VIEW_HEARTBEAT_INTERVAL_MS,
  emission_threshold_ms = DATA_VIEW_EMISSION_THRESHOLD_MS,
  accepted_slow_queries = ACCEPTED_SLOW_QUERIES
}) {
  // Which executor runs is decided HERE rather than at each of the four call
  // sites, because one of those call sites is the export route -- the only path
  // that loads a persisted table_state server-side, and the one that would
  // otherwise index the registry resolver with an ad-hoc column_id and raise a
  // TypeError as a 500. A per-call-site branch is a branch somebody forgets;
  // this is the single point every path already goes through.
  //
  // An explicitly passed run_query still wins, which is what the specs use.
  const resolved_run_query =
    run_query ||
    (params && params.query_id ? run_query_backed_view : get_data_view_results)

  const exec_id = execution_id || mint_execution_id()
  const request_started_at = Date.now()
  const started_at = new Date(request_started_at).toISOString()
  // timeout_ms is a SERVER-resolved override (the export route raises it for a
  // key-holding bulk caller), never a value read off a request body. The
  // viewer-derived default stands for every other path.
  const timeout =
    timeout_ms ||
    (user_id ? DATA_VIEW_SIGNED_IN_TIMEOUT_MS : DATA_VIEW_SIGNED_OUT_TIMEOUT_MS)
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

  // Admission class travels with the path, so the export route needs to do
  // nothing but keep passing path: 'export' as it already does.
  const admission_class = admission_class_for_path(path)

  let state = 'waiting'
  let acquired = false
  try {
    await acquire_slot(signal, admission_class)
    acquired = true

    // Re-check the cache at admission: a concurrent execution of the same view
    // may have populated it while this request waited, so a same-view duplicate
    // returns the finished first execution's rows instead of re-running. The
    // /debug route and ignore_cache exports pass skip_cache to bypass this.
    const cached = skip_cache ? null : await cache_get(cache_key)
    if (cached) {
      admission.counters.cache_hits++
      admission.counters.completed++
      const admission_wait_duration_ms = Date.now() - request_started_at
      log_data_view_telemetry({
        event: 'execution',
        execution_id: exec_id,
        request_id,
        path,
        outcome: 'cache_hit',
        admission_wait_duration_ms,
        query_execution_duration_ms: 0,
        result_row_count: (cached.data_view_results || []).length,
        user_id: user_id ? 'signed-in' : 'anonymous'
      })
      return {
        data_view_results: cached.data_view_results,
        data_view_metadata: cached.data_view_metadata,
        // Carried through the cache the same as the miss path returns it. The
        // envelope persisted only these first two keys until 2026-08-28, which
        // is what dropped anything else run_query returned -- not the JSON
        // serialization, which round-trips a pg Field losslessly.
        data_view_fields: cached.data_view_fields,
        execution_id: exec_id,
        admission_wait_duration_ms,
        query_execution_duration_ms: 0,
        result_row_count: (cached.data_view_results || []).length,
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
    //
    // The sandboxed-SQL run_query is the deliberate exception: it needs a real
    // transaction block because SET TRANSACTION READ ONLY has nowhere else to
    // live, and it pays a round trip per statement to get it.
    const { data_view_results, data_view_metadata, data_view_fields } =
      await resolved_run_query({
        ...params,
        calculate_total_count,
        // Timeout after the spread: the client's table state must not be able to
        // name its own deadline. `timeout` reaches Postgres as SET LOCAL
        // statement_timeout verbatim. `max_limit` is here for the same reason --
        // a table state carrying its own `max_limit` would otherwise raise the
        // ceiling the route resolved for the caller.
        timeout,
        max_limit,
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
        { data_view_results, data_view_metadata, data_view_fields },
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
      // The pg field descriptors, in projection order. They must NOT be folded
      // into data_view_metadata: raw pg descriptors carry tableID and columnID
      // schema OIDs and the client merges metadata wholesale, so the deriver
      // reads these server-side and emits metadata.columns from them.
      data_view_fields,
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
    if (acquired) release_slot(admission_class)
  }
}
