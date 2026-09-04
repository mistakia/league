#!/usr/bin/env node

// The instruction-to-answer benchmark for agentic data-view generation.
//
// Takes a set of natural-language instructions and emits ONE COMPARABLE ROW PER
// RUN: status, duration, turns, output tokens, tool-call composition by class,
// branch, contention, and pass/fail. The point is to rank a change by
// measurement instead of by a single run, so everything here is built around
// two rules that a casual harness gets wrong.
//
// RULE ONE: A GREEN RUN PROVES NOTHING ABOUT CORRECTNESS. A run that completes
// and emits a plausible-looking table_state has demonstrated that it produced
// well-formed output, not that it answered the question. So this runner
// EXECUTES the emitted table_state against production and compares the rows to
// an answer derived independently in SQL -- see
// scripts/data-view-benchmark-ground-truth.mjs, which is where the expected
// values come from and why they are not hand-written. Status and correctness
// are separate columns and they disagree often enough that collapsing them
// would hide the interesting cases.
//
// RULE TWO: COUNT TURNS BY DISTINCT `message.id`. The transcript writes roughly
// 2.7 records per API call, so counting `type: "assistant"` records inflates
// everything downstream of it -- measured 80 records against 26 real turns, and
// 40,294 output tokens against 12,553, while the authoritative `cost-state`
// line disagreed the whole time. A distinct id is one API call. This runner
// additionally requires the id to carry at least one text, thinking or tool_use
// block, because some providers emit empty assistant messages mid-turn; on
// deepseek-v4-flash the two rules agree exactly, and the stricter one costs
// nothing while protecting against the provider that does not.
//
// WALL CLOCK IS NOT COMPARABLE ACROSS SITTINGS. Both GPUs are shared with every
// other live session on the fleet and cold prefill throughput swings by more
// than an order of magnitude on load alone. Duration is recorded because it is
// cheap and occasionally diagnostic, but a change is ranked on turns, output
// tokens and tool-call composition. Contention is sampled PER INSTRUCTION
// rather than once per invocation, because prefix retention is eviction-driven
// and two instructions at different contention are measuring different systems.
//
//   NODE_ENV=production node scripts/data-view-benchmark-run.mjs
//   NODE_ENV=production node scripts/data-view-benchmark-run.mjs \
//     --select qb-passing-yards-2023 --select wr-receiving-yards-2023 --repeat 3
//   NODE_ENV=production node scripts/data-view-benchmark-run.mjs --json
//
// Runs are SERIALIZED because the generation profile permits one concurrent
// session. Nothing here dispatches a second job while one is live.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execFile } from 'child_process'
import { promisify } from 'util'

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { execute_data_view_request } from '#libs-server/data-views/execute-data-view-request.mjs'
import {
  derive_transcript_metrics,
  parse_transcript,
  row_identity
} from '#libs-server/data-views/generation/benchmark-metrics.mjs'
import {
  league_topology,
  resolve_user_base_directory
} from '#libs-server/league-topology.mjs'
import { is_main } from '#libs-server'

const exec_file = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const INSTRUCTIONS_PATH = path.join(
  __dirname,
  '..',
  'test',
  'data-view-benchmark',
  'instructions.json'
)

// The session rail lives on another host, so every fact about a run that league
// does not store has to be fetched over ssh -- which needs a hostname, a tenant
// container, the uid that owns the 0600 transcript inside it, and where that
// transcript sits. All four describe this fleet rather than the application,
// and this repository is public, so they are CONFIGURATION with no default:
// see libs-server/league-topology.mjs for where they come from and why it is not
// sops-encrypted. Resolved lazily at each call site, because
// data-view-benchmark-ground-truth.mjs imports this module for
// `check_correctness` alone and must not need any of it.
//
// `base` and `base thread` run against the user base, not this checkout.
const USER_BASE_DIR = resolve_user_base_directory()

const PRINCIPAL_KEY = process.env.LEAGUE_BENCHMARK_PRINCIPAL_KEY || 'user:1'
const BENCHMARK_USER_ID = Number(process.env.LEAGUE_BENCHMARK_USER_ID || 1)

const POLL_INTERVAL_MS = 5 * 1000
// The job's own deadline is 15 minutes and the sweep closes it there. This is
// the runner's patience for the row reaching a terminal status AFTER that, and
// exceeding it is a defect in the sweep rather than a slow run.
const RUN_TIMEOUT_MS = 22 * 60 * 1000

// How long to wait for the harness to flush its `cost-state` line after the job
// row goes terminal. Seconds in practice; the bound exists so a session that
// dies without flushing costs one wait rather than the run.
const TRANSCRIPT_SETTLE_TIMEOUT_MS = 90 * 1000
const TRANSCRIPT_SETTLE_POLL_MS = 3 * 1000

// How hard the runner tries to release a finished run's session, and how long it
// then waits for the slot to actually be free. Both exist because the SAME
// failure -- a session left registered as running -- is silent at the point it
// happens and only shows up as the next three instructions expiring.
const REAP_ATTEMPTS = 3
const REAP_RETRY_MS = 10 * 1000
const SLOT_WAIT_TIMEOUT_MS = 3 * 60 * 1000
const SLOT_POLL_MS = 5 * 1000

// The session_slug prefix `dispatch_generation_session` mints, which is how a
// generation session is told apart from every other live thread in the running
// list. Kept in step with base-session-client.mjs by nothing but this comment:
// the runner cannot import from libs-server without dragging the dispatch path
// into a script that must not dispatch.
const GENERATION_SESSION_LABEL_PREFIX = 'data-view-generation-'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Run a command, returning stdout and never throwing.
 *
 * Every shell-out here is diagnostic rather than load-bearing: a benchmark run
 * that cannot read the contention figure should still report its turns, with a
 * null in that column, rather than dying and losing the run it just spent.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {object} [options]
 * @returns {Promise<{ok: boolean, stdout: string, error: string|null}>}
 */
const try_exec = async (command, args, options = {}) => {
  try {
    const { stdout } = await exec_file(command, args, {
      maxBuffer: 64 * 1024 * 1024,
      ...options
    })
    return { ok: true, stdout, error: null }
  } catch (error) {
    return { ok: false, stdout: '', error: error.message }
  }
}

/**
 * How many sessions are running fleet-wide right now.
 *
 * @returns {Promise<number|null>}
 */
export const read_contention = async () => {
  const { ok, stdout } = await try_exec(
    'base',
    ['thread', 'list', '--running'],
    {
      cwd: USER_BASE_DIR
    }
  )
  if (!ok) return null
  const lines = stdout.split('\n').filter((line) => line.trim().length)
  return lines.length
}

/**
 * The vLLM prefix-cache counters, sampled now.
 *
 * Cumulative and fleet-wide, so only the DIFFERENCE across one dispatch is
 * attributable -- and even that is contaminated by concurrent sessions, which
 * is why the contention figure is recorded beside it.
 *
 * @returns {Promise<{queries: number, hits: number}|null>}
 */
export const read_prefix_cache_counters = async () => {
  const topology = league_topology('generation')
  const { ok, stdout } = await try_exec('ssh', [
    topology.host,
    `curl -s ${topology.metrics_url} | grep -E '^vllm:prefix_cache_(queries|hits)_total'`
  ])
  if (!ok) return null
  const read = (name) => {
    const match = stdout.match(
      new RegExp(`^vllm:prefix_cache_${name}_total[^ ]* ([0-9.e+]+)`, 'm')
    )
    return match ? Number(match[1]) : null
  }
  const queries = read('queries')
  const hits = read('hits')
  if (queries === null && hits === null) return null
  return { queries, hits }
}

/**
 * Insert one queued job. The drainer claims it within seconds.
 *
 * `deadline_at` is deliberately not supplied so the column default applies --
 * setting it here would let a benchmark quietly measure a different deadline
 * than production uses.
 *
 * `input_table_state` is stringified rather than passed as an object because
 * the column is jsonb and knex would otherwise bind a JS object as a record
 * literal; this matches what `enqueue_generation_job` in the production queue
 * does with the same column.
 *
 * @param {object} params
 * @param {string} params.instruction
 * @param {object|null} [params.input_table_state] - the edit case
 * @returns {Promise<string>} generation_id
 */
export const enqueue_generation_job = async ({
  instruction,
  input_table_state = null,
  harness = null,
  model = null
}) => {
  const [row] = await db('data_view_generation_jobs')
    .insert({
      instruction,
      input_table_state: input_table_state
        ? JSON.stringify(input_table_state)
        : null,
      // Null means the identity's default, which is what production sends. The
      // sweep names one only when it is comparing.
      harness,
      model,
      user_id: BENCHMARK_USER_ID,
      principal_key: PRINCIPAL_KEY,
      status: 'queued'
    })
    .returning('generation_id')
  return row.generation_id || row
}

const TERMINAL_JOB_STATUSES = ['completed', 'failed', 'expired']

/**
 * Poll one job row to a terminal status.
 *
 * @param {object} params
 * @param {string} params.generation_id
 * @param {(message: string) => void} params.log
 * @returns {Promise<object>}
 */
export const await_job_completion = async ({ generation_id, log }) => {
  const started = Date.now()
  let last_status = null
  for (;;) {
    const job = await db('data_view_generation_jobs')
      .where({ generation_id })
      .first()
    if (!job) throw new Error(`job ${generation_id} disappeared`)

    if (job.status !== last_status) {
      log(`  status: ${job.status}`)
      last_status = job.status
    }
    if (TERMINAL_JOB_STATUSES.includes(job.status)) return job

    if (Date.now() - started > RUN_TIMEOUT_MS) {
      // Returned rather than thrown: a row stuck in `running` past its own
      // deadline is a real measurement about the sweep, and losing the rest of
      // the benchmark over it would be the wrong trade.
      log(
        `  gave up waiting after ${Math.round((Date.now() - started) / 1000)}s`
      )
      return { ...job, runner_timed_out: true }
    }
    await sleep(POLL_INTERVAL_MS)
  }
}

/**
 * The claude session id backing a thread.
 *
 * The transcript on disk is named for the SESSION, while league only ever
 * records the THREAD, so this hop is required and there is no way to guess it
 * from the job row.
 *
 * @param {string} thread_id
 * @returns {Promise<string|null>}
 */
export const read_session_id = async ({ thread_id }) => {
  const { ok, stdout } = await try_exec(
    'base',
    ['thread', 'get', thread_id, '--json'],
    { cwd: USER_BASE_DIR }
  )
  if (!ok) return null
  try {
    const parsed = JSON.parse(stdout)
    const thread = parsed.thread || parsed
    return thread?.external_session?.session_id || null
  } catch {
    return null
  }
}

/**
 * Pull one session transcript out of the tenant container.
 *
 * WAITS FOR THE `cost-state` LINE, and this is not politeness. The line is
 * written when the session ends, and the session ends some seconds AFTER the
 * job row goes terminal -- the emission closes the row, then the reap kills the
 * harness, then the harness flushes. Reading in that window returns a transcript
 * that is real but SHORT, and it is short in the direction that looks like a
 * result: measured on one run, an early read reported 18 turns and 6,816 output
 * tokens with no cost-state at all, where the settled file said 19 and 7,100
 * with an authoritative 7,337. Nothing about the early read announces itself as
 * partial.
 *
 * A transcript that never settles is still returned, with whatever it has. That
 * is honest -- the caller can see `cost_state_present: false` -- and it is
 * better than losing a run that has already been spent.
 *
 * @param {object} params
 * @param {string} params.session_id
 * @param {(message: string) => void} params.log
 * @returns {Promise<object[]|null>} parsed JSONL records
 */
export const read_transcript = async ({ session_id, log = () => {} }) => {
  const deadline = Date.now() + TRANSCRIPT_SETTLE_TIMEOUT_MS
  const topology = league_topology('generation')
  let records = null

  for (;;) {
    const { ok, stdout } = await try_exec('ssh', [
      topology.host,
      `docker exec -u ${topology.container_user} ${topology.container} cat ${topology.transcript_dir}/${session_id}.jsonl`
    ])
    if (ok && stdout.trim()) {
      records = parse_transcript(stdout)
      if (records.some((record) => record.type === 'cost-state')) return records
    }
    if (Date.now() > deadline) {
      if (records) {
        log(
          '     transcript never wrote a cost-state line; token totals are the per-turn sums only'
        )
      }
      return records
    }
    await sleep(TRANSCRIPT_SETTLE_POLL_MS)
  }
}

/**
 * Does the row carry the expected measure anywhere in it?
 *
 * Checked against EVERY numeric field rather than a named column, because the
 * agent chooses its own columns and their order, so the result key for the
 * ranked statistic is not knowable in advance. Matching on value is
 * column-key-agnostic and still discriminating: a run that ranked by the wrong
 * statistic returns the wrong magnitude and fails here even when it happened to
 * order the leaders correctly.
 *
 * @param {object} row
 * @param {number} expected
 * @param {number} tolerance
 * @returns {boolean}
 */
const row_carries_measure = (row, expected, tolerance) => {
  const allowed = Math.max(Math.abs(expected) * tolerance, 0.011)
  return Object.values(row).some(
    (value) =>
      typeof value === 'number' && Math.abs(value - expected) <= allowed
  )
}

/**
 * Execute the emitted table_state against production and grade it.
 *
 * THIS IS THE STEP A GREEN RUN CANNOT SUBSTITUTE FOR. Everything above measures
 * what a run spent; this measures whether it was right.
 *
 * @param {object} params
 * @param {object} params.table_state
 * @param {object} params.entry - the instruction entry with its assertion
 * @returns {Promise<object>}
 */
export const check_correctness = async ({ table_state, entry }) => {
  if (!table_state) {
    return { correct: false, reason: 'no table_state was emitted' }
  }

  const limit = Math.max(entry.min_rows || 0, entry.expected_leaders.length, 5)

  let rows
  try {
    const { data_view_results } = await execute_data_view_request({
      request_id: null,
      params: { ...table_state, offset: 0, limit },
      user_id: null,
      path: 'benchmark',
      cache_key: null,
      skip_cache: true
    })
    rows = data_view_results || []
  } catch (error) {
    return {
      correct: false,
      reason: `emitted table_state failed to execute: ${error.message}`
    }
  }

  if (rows.length < Math.min(entry.min_rows || 0, limit)) {
    return {
      correct: false,
      reason: `returned ${rows.length} rows, expected at least ${entry.min_rows}`,
      returned_rows: rows.length
    }
  }

  const mismatches = []
  entry.expected_leaders.forEach((leader, index) => {
    const row = rows[index]
    if (!row) {
      mismatches.push(`rank ${index + 1}: no row returned`)
      return
    }
    const identity = row_identity(row, entry.identity_key)
    if (identity === null) {
      mismatches.push(
        `rank ${index + 1}: no ${entry.identity_key} in row (keys: ${Object.keys(row).join(',')})`
      )
      return
    }
    if (identity !== leader.identity) {
      mismatches.push(
        `rank ${index + 1}: got ${identity}, expected ${leader.identity} (${leader.label})`
      )
      return
    }
    if (!row_carries_measure(row, leader.measure, entry.measure_tolerance)) {
      mismatches.push(
        `rank ${index + 1}: ${leader.label} present but no field equals ${leader.measure}`
      )
    }
  })

  return {
    correct: mismatches.length === 0,
    reason: mismatches.length ? mismatches.join('; ') : null,
    returned_rows: rows.length
  }
}

/**
 * Release the session a finished run strands.
 *
 * Every finished run leaves its session registered as running, where it holds
 * the profile's single concurrency slot and blocks the next dispatch. This is a
 * base-side reconciler defect, not something the benchmark caused, and it is
 * not fixed -- so the runner clears it or the second instruction never
 * dispatches.
 *
 * The process check comes first: ending a thread whose agent is still thinking
 * would kill a live run, and the whole point is to reap the ones that are
 * already gone.
 *
 * @param {object} params
 * @param {string} params.thread_id
 * @param {(message: string) => void} params.log
 * @returns {Promise<{reaped: boolean, reason: string}>}
 */
export const reap_stranded_session = async ({ thread_id, log }) => {
  if (!thread_id)
    return { reaped: false, reason: 'no thread_id on the job row' }

  const topology = league_topology('generation')
  const { ok, stdout } = await try_exec('ssh', [
    topology.host,
    `docker exec -u ${topology.container_user} ${topology.container} ps -eo pid,args || true`
  ])
  if (!ok) {
    return { reaped: false, reason: 'could not inspect container processes' }
  }
  const claude_processes = stdout
    .split('\n')
    .filter((line) => /claude/.test(line) && !/grep/.test(line))
  if (claude_processes.length) {
    return {
      reaped: false,
      reason: `${claude_processes.length} claude process(es) still running; left alone`
    }
  }

  // RETRIED, because a reap that fails once costs every REMAINING instruction.
  // `base thread end` answered "Thread not found" on two consecutive runs of the
  // 2026-09-04 sweep for threads that resolve fine minutes later -- the record is
  // briefly unresolvable to this host right after the session is created. The
  // old code logged that and moved on, which left the slot held and made the
  // three instructions behind it expire un-dispatched at 15 minutes each. A
  // transient miss must not be indistinguishable from a released session.
  let last_error = null
  for (let attempt = 1; attempt <= REAP_ATTEMPTS; attempt++) {
    const ended = await try_exec(
      'base',
      ['thread', 'end', thread_id, '--force-cross-thread'],
      { cwd: USER_BASE_DIR }
    )
    if (ended.ok) {
      log('  stranded session released')
      return { reaped: true, reason: 'ended' }
    }
    last_error = ended.error
    if (attempt < REAP_ATTEMPTS) {
      log(`  reap attempt ${attempt} failed, retrying: ${ended.error}`)
      await sleep(REAP_RETRY_MS)
    }
  }

  log(`  session reap failed after ${REAP_ATTEMPTS} attempts: ${last_error}`)
  return { reaped: false, reason: last_error }
}

/**
 * Wait until no STRANDED generation session holds the profile's single slot.
 *
 * THE PRECONDITION EVERY DISPATCH DEPENDS ON, asserted rather than assumed. The
 * drainer cannot claim a job while a session is registered as running, and a job
 * it never claims does not fail -- it sits `queued` until its own 15-minute
 * deadline and is recorded `expired` with a null `dispatched_at`. That row looks
 * exactly like a generation too slow to finish, so a held slot reads as the
 * thing the benchmark exists to measure. Three rows of the 2026-09-04 sweep were
 * read that way before the null dispatch timestamp gave it away.
 *
 * SCOPE, measured rather than assumed: a HEALTHY in-flight generation session
 * does not appear in `base thread list --running` at all. Polled every 8s across
 * a 32-second run on 2026-09-04, the list never once showed it, while the job row
 * went queued -> running -> completed throughout. What the list DOES surface is
 * the stranded case -- a session the reconciler left in `awaiting_user` after its
 * job went terminal -- which is the only state that actually blocks a later
 * dispatch, and is exactly the state that wedged that sweep. So this is a
 * leftover-detector, not a concurrency gate; serialization is what keeps two live
 * runs from overlapping, and this catches the corpse the previous run left behind.
 *
 * Returns rather than throws when the slot stays held: the caller reports it on
 * the row, and one stuck sweep should not discard the runs already paid for.
 *
 * @param {object} params
 * @param {(message: string) => void} params.log
 * @returns {Promise<{free: boolean, holder: string|null}>}
 */
export const await_generation_slot_free = async ({ log }) => {
  const deadline = Date.now() + SLOT_WAIT_TIMEOUT_MS
  let announced = false

  for (;;) {
    const { ok, stdout } = await try_exec(
      'base',
      ['thread', 'list', '--running'],
      { cwd: USER_BASE_DIR }
    )
    // A list we could not read is not evidence the slot is held. Proceeding is
    // the safe direction: the dispatch either succeeds or returns a 429 the job
    // row records honestly.
    if (!ok) return { free: true, holder: null }

    const holder = stdout
      .split('\n')
      .find((line) => line.includes(GENERATION_SESSION_LABEL_PREFIX))
    if (!holder) {
      if (announced) log('  slot released')
      return { free: true, holder: null }
    }

    const thread_id = holder
      .split(/\s+/)
      .find((field) => UUID_PATTERN.test(field))
    if (!announced) {
      log(
        `  waiting for the generation slot, held by ${thread_id || 'a session'}`
      )
      announced = true
    }

    if (Date.now() > deadline) {
      return { free: false, holder: thread_id || null }
    }
    await sleep(SLOT_POLL_MS)
  }
}

/**
 * One instruction, once: dispatch, wait, measure, grade.
 *
 * @param {object} params
 * @returns {Promise<object>}
 */
export const run_one = async ({
  entry,
  iteration,
  log,
  harness = null,
  model = null
}) => {
  log(`\n${entry.instruction_id} (run ${iteration})`)
  log(`  "${entry.instruction}"`)

  // Before the clock starts, not after: a job enqueued against a held slot
  // spends its whole 15-minute deadline queued, and the wall time it reports is
  // the deadline rather than anything the agent did.
  const slot = await await_generation_slot_free({ log })

  const contention_before = await read_contention()
  const cache_before = await read_prefix_cache_counters()
  const wall_start = Date.now()

  const generation_id = await enqueue_generation_job({
    instruction: entry.instruction,
    input_table_state: entry.input_table_state || null,
    harness,
    model
  })
  log(`  generation_id ${generation_id}`)

  const job = await await_job_completion({ generation_id, log })
  const wall_ms = Date.now() - wall_start

  const contention_after = await read_contention()
  const cache_after = await read_prefix_cache_counters()

  const reap = await reap_stranded_session({ thread_id: job.thread_id, log })

  let metrics = null
  let session_id = null
  if (job.thread_id) {
    session_id = await read_session_id({ thread_id: job.thread_id })
    if (session_id) {
      const records = await read_transcript({ session_id, log })
      if (records) metrics = derive_transcript_metrics(records)
    }
  }

  const table_state = job.result?.table_state || null
  const correctness = await check_correctness({ table_state, entry })

  const cache_delta =
    cache_before && cache_after
      ? {
          queries: cache_after.queries - cache_before.queries,
          hits: cache_after.hits - cache_before.hits
        }
      : null

  const row = {
    instruction_id: entry.instruction_id,
    capability: entry.capability,
    iteration,
    // What the sweep ASKED for, null when it asked for nothing. Distinct from
    // `models` below, which is what the transcript says actually served the
    // turns -- they disagree when a request falls back, and a sweep that
    // recorded only one of them could not tell a real comparison from a silent
    // reversion to the default.
    requested_harness: harness,
    requested_model: model,
    generation_id,
    thread_id: job.thread_id || null,
    session_id,
    status: job.status,
    runner_timed_out: Boolean(job.runner_timed_out),
    // The two columns that separate "the agent was slow" from "the job never
    // reached an agent". A null dispatch timestamp on an expired row means the
    // drainer never claimed it, which is a capacity fact about the sweep and
    // says nothing about the instruction.
    dispatched_at: job.dispatched_at ? job.dispatched_at.toISOString() : null,
    slot_free_before_dispatch: slot.free,
    branch: job.generation_branch || null,
    error_code: job.error_code || null,
    wall_ms,
    job_duration_ms: job.duration_milliseconds ?? null,
    turns: metrics?.turns ?? null,
    output_tokens: metrics?.output_tokens ?? null,
    input_tokens: metrics?.input_tokens ?? null,
    cost_state_output_tokens: metrics?.cost_state_output_tokens ?? null,
    output_token_gap: metrics?.output_token_gap ?? null,
    tool_calls: metrics?.tool_call_count ?? null,
    buckets: metrics?.buckets ?? null,
    tool_names: metrics?.tool_names ?? null,
    api_duration_ms: metrics?.total_api_duration_ms ?? null,
    tool_duration_ms: metrics?.total_tool_duration_ms ?? null,
    models: metrics?.models ?? null,
    provider_error: metrics?.provider_error ?? null,
    correct: correctness.correct,
    correctness_reason: correctness.reason,
    returned_rows: correctness.returned_rows ?? null,
    contention_before,
    contention_after,
    prefix_cache_delta: cache_delta,
    session_reaped: reap.reaped,
    measured_at: new Date().toISOString()
  }

  log(
    `  -> ${row.status} | turns ${row.turns ?? '?'} | output ${row.output_tokens ?? '?'} | ` +
      `calls ${row.tool_calls ?? '?'} | correct ${row.correct ? 'YES' : 'NO'}`
  )
  if (!row.correct && row.correctness_reason) {
    log(`     ${row.correctness_reason}`)
  }
  if (row.provider_error) {
    log(`     PROVIDER ERROR in transcript: ${row.provider_error}`)
  }
  if (metrics === null) {
    log(
      '     no transcript metrics; turn and token columns are absence of data, not zero'
    )
  }

  return row
}

/**
 * @param {object[]} rows
 * @returns {string}
 */
export const format_table = (rows) => {
  const header = [
    'instruction',
    'run',
    'status',
    'branch',
    'turns',
    'output',
    'calls',
    'dives',
    'correct',
    'contention'
  ]
  const body = rows.map((row) => [
    row.instruction_id,
    String(row.iteration),
    // UNDISPATCHED outranks the job's own status deliberately: `expired` with
    // no dispatch is a queue fact, and printing it as `expired` invites reading
    // a capacity problem as a slow instruction.
    row.runner_timed_out
      ? 'STUCK'
      : row.dispatched_at === null && row.status === 'expired'
        ? 'UNDISPATCHED'
        : row.status,
    row.branch || '-',
    row.turns === null ? '?' : String(row.turns),
    row.output_tokens === null ? '?' : String(row.output_tokens),
    row.tool_calls === null ? '?' : String(row.tool_calls),
    row.buckets ? String(row.buckets['source-dive'] || 0) : '?',
    row.provider_error ? 'PROVIDER' : row.correct ? 'yes' : 'NO',
    row.contention_before === null ? '?' : String(row.contention_before)
  ])
  const widths = header.map((cell, index) =>
    Math.max(cell.length, ...body.map((line) => line[index].length))
  )
  const render = (cells) =>
    cells.map((cell, index) => cell.padEnd(widths[index])).join('  ')
  return [
    render(header),
    render(widths.map((width) => '-'.repeat(width))),
    ...body.map(render)
  ].join('\n')
}

const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .option('select', {
      type: 'array',
      describe: 'instruction_id to run; repeatable. Default: every instruction'
    })
    .option('repeat', {
      type: 'number',
      default: 1,
      describe:
        'runs per instruction. Run-to-run spread on one instruction was 8, 9, 11 turns, so a single run cannot rank a change'
    })
    .option('harness', {
      type: 'array',
      describe:
        'harness to dispatch on; repeatable, and every instruction runs once per value. Default: the identity default'
    })
    .option('model', {
      type: 'array',
      describe:
        'model to dispatch on; repeatable, and every instruction runs once per value. Effort level rides on this axis -- it comes from the model registry entry reasoning_effort, not from a flag'
    })
    .option('json', { type: 'boolean', default: false })
    .option('out', {
      type: 'string',
      describe: 'append each row as JSON to this file as it completes'
    })
    .help().argv

  const quiet = argv.json
  const log = (message) => {
    if (!quiet) console.log(message)
  }

  const instruction_set = JSON.parse(fs.readFileSync(INSTRUCTIONS_PATH, 'utf8'))
  const selected = argv.select?.length
    ? instruction_set.entries.filter((entry) =>
        argv.select.includes(entry.instruction_id)
      )
    : instruction_set.entries

  if (!selected.length) {
    throw new Error(
      `no instructions matched --select. Available: ${instruction_set.entries.map((entry) => entry.instruction_id).join(', ')}`
    )
  }

  // The CROSS PRODUCT of the two configuration axes, with `null` standing for
  // "whatever the identity defaults to". A sweep that named neither runs exactly
  // as it always did, one arm of `[null]` x `[null]`, so the default invocation
  // is unchanged.
  const harness_arm = argv.harness?.length ? argv.harness : [null]
  const model_arm = argv.model?.length ? argv.model : [null]
  const arms = harness_arm.flatMap((harness) =>
    model_arm.map((model) => ({ harness, model }))
  )

  log(
    `benchmark: ${selected.length} instruction(s) x ${argv.repeat} run(s) x ${arms.length} arm(s), serialized`
  )
  log(`assertions derived ${instruction_set.generated_at}`)

  const rows = []
  // ARM OUTERMOST, iteration next, instruction innermost. Contention drifts over
  // a sweep -- it climbed from 10 to 14 across one 2026-09-04 sitting -- so
  // interleaving the arms would hand each one a different slice of that drift
  // and read the difference as a property of the harness.
  for (const { harness, model } of arms) {
    if (harness || model) {
      log(`\narm: harness=${harness || 'default'} model=${model || 'default'}`)
    }
    for (let iteration = 1; iteration <= argv.repeat; iteration++) {
      for (const entry of selected) {
        const row = await run_one({ entry, iteration, log, harness, model })
        rows.push(row)
        if (argv.out) fs.appendFileSync(argv.out, `${JSON.stringify(row)}\n`)
      }
    }
  }

  if (argv.json) {
    console.log(JSON.stringify({ rows }, null, 2))
  } else {
    console.log(`\n${format_table(rows)}`)
    const correct = rows.filter((row) => row.correct).length
    console.log(`\n${correct}/${rows.length} correct`)
  }
}

if (is_main(import.meta.url)) {
  main()
    .then(() => db.destroy())
    .catch(async (error) => {
      console.error(error.stack || error.message)
      await db.destroy()
      process.exit(1)
    })
}

export default {
  check_correctness,
  format_table,
  run_one
}
