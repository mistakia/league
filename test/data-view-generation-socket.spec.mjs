/* global describe, before, beforeEach, it */

import * as chai from 'chai'

import db from '#db'
import {
  enqueue_generation_job,
  complete_generation_job,
  MAX_QUEUE_DEPTH
} from '#libs-server/data-views/generation/generation-job-queue.mjs'
import {
  handle_generation_request,
  handle_generation_collect,
  project_generation_job,
  relay_timeline_entries,
  require_generation_principal,
  stop_generation_watchers,
  watch_generation_job
} from '#api/sockets/data-view-generation.mjs'

process.env.NODE_ENV = 'test'

const expect = chai.expect

// Socket delivery for generation, against the real job table.
//
// The websocket is a FAKE and the job row is REAL, which is the right way
// round: what is under test is which frames a client receives for which row
// state, and the row is the authority the handler reads. A real socket would
// add a transport this file is not about; a fake row would make every
// assertion true by construction.

const fake_socket = () => ({
  readyState: 1,
  client_id: 'test',
  sent: [],
  send(raw) {
    this.sent.push(JSON.parse(raw))
  },
  frames_of(type) {
    return this.sent.filter((frame) => frame.type === type)
  },
  last() {
    return this.sent[this.sent.length - 1]
  }
})

// The watch is injected everywhere below, so no test spawns a real poll loop.
const no_watch = () => {
  const calls = []
  const watch = async (params) => {
    calls.push(params)
  }
  watch.calls = calls
  return watch
}

describe('data view generation socket', function () {
  this.timeout(30000)

  // The entitled accounts every other case in this file acts as, and the ONE
  // that is not. GENERATION_USER_ID and OTHER_USER_ID carry the flag because
  // admission now requires it; NOT_ENABLED_USER_ID is the negative control, and
  // it is a real row rather than a missing one so the two refusal causes stay
  // distinguishable.
  const GENERATION_USER_ID = 1
  const OTHER_USER_ID = 2
  const NOT_ENABLED_USER_ID = 3

  before(async function () {
    const exists = await db.schema.hasTable('data_view_generation_jobs')
    expect(
      exists,
      'data_view_generation_jobs exists -- apply db/adhoc/2026-09-02-create-data-view-generation-jobs.sql'
    ).to.equal(true)

    await db('users')
      .insert([
        {
          id: GENERATION_USER_ID,
          username: 'generation_one',
          email: 'generation_one@example.invalid',
          data_view_generation_is_enabled: true
        },
        {
          id: OTHER_USER_ID,
          username: 'generation_two',
          email: 'generation_two@example.invalid',
          data_view_generation_is_enabled: true
        },
        {
          id: NOT_ENABLED_USER_ID,
          username: 'generation_none',
          email: 'generation_none@example.invalid'
        }
      ])
      .onConflict('id')
      .merge()
  })

  beforeEach(async function () {
    await db('data_view_generation_jobs').del()
  })

  describe('admission', function () {
    it('requires authentication at launch', async function () {
      const admission = await require_generation_principal({ user_id: null })
      expect(admission.admitted).to.equal(false)
      expect(admission.error_code).to.equal('authentication_required')
    })

    it('admits an entitled account', async function () {
      const admission = await require_generation_principal({
        user_id: GENERATION_USER_ID
      })
      expect(admission.admitted).to.equal(true)
    })

    // THE NEGATIVE CONTROL FOR THE ENTITLEMENT, and it runs beside the positive
    // one above so the gate cannot be passing by refusing everybody.
    it('refuses a signed-in account that is not enabled', async function () {
      const admission = await require_generation_principal({
        user_id: NOT_ENABLED_USER_ID
      })
      expect(admission.admitted).to.equal(false)
      expect(admission.error_code).to.equal('generation_not_enabled')
    })

    // Fails CLOSED on a row that is not there. An authenticated id with no user
    // row is a deleted account or a token that outlived one, and neither is a
    // reason to admit a run -- which is the direction a `!== false` read of the
    // column would have gone.
    it('refuses an authenticated id with no user row', async function () {
      const admission = await require_generation_principal({
        user_id: 99999
      })
      expect(admission.admitted).to.equal(false)
      expect(admission.error_code).to.equal('generation_not_enabled')
    })

    // The column DEFAULT is read off a FRESHLY INSERTED ROW rather than off the
    // DDL, because what the gate depends on is what an account created tomorrow
    // actually gets.
    it('defaults a newly created account to closed', async function () {
      // An explicit id rather than the sequence: this file seeds ids 1-3
      // directly, which does not advance users_id_seq, so a bare insert would
      // collide on the primary key instead of exercising the column default.
      const [inserted] = await db('users')
        .insert({
          id: 424242,
          username: 'generation_fresh',
          email: 'generation_fresh@example.invalid'
        })
        .returning('*')
      expect(inserted.data_view_generation_is_enabled).to.equal(false)
      await db('users').where({ id: inserted.id }).del()
    })

    it('refuses an anonymous request WITHOUT creating a job', async function () {
      const ws = fake_socket()
      const job = await handle_generation_request({
        ws,
        user_id: null,
        payload: { instruction: 'top receivers' },
        watch: no_watch()
      })
      expect(job).to.equal(null)
      expect(ws.last().type).to.equal('DATA_VIEW_GENERATION_ERROR')
      expect(await db('data_view_generation_jobs')).to.have.lengthOf(0)
    })

    it('refuses an unentitled request WITHOUT creating a job', async function () {
      const ws = fake_socket()
      const job = await handle_generation_request({
        ws,
        user_id: NOT_ENABLED_USER_ID,
        payload: { instruction: 'top receivers' },
        watch: no_watch()
      })
      expect(job).to.equal(null)
      expect(ws.last().payload.error_code).to.equal('generation_not_enabled')
      expect(await db('data_view_generation_jobs')).to.have.lengthOf(0)
    })

    // The SAME instruction, in the SAME run, from an entitled account. Without
    // this the refusal above could be a handler that refuses everything.
    it('admits the same request from an entitled account', async function () {
      const ws = fake_socket()
      const job = await handle_generation_request({
        ws,
        user_id: GENERATION_USER_ID,
        payload: { instruction: 'top receivers' },
        watch: no_watch()
      })
      expect(job).to.not.equal(null)
      expect(ws.last().type).to.equal('DATA_VIEW_GENERATION_ACCEPTED')
    })

    it('refuses an unentitled account a COLLECT of its own job', async function () {
      const ws = fake_socket()
      await handle_generation_collect({
        ws,
        user_id: NOT_ENABLED_USER_ID,
        payload: { generation_id: 'anything' },
        watch: no_watch()
      })
      expect(ws.last().payload.error_code).to.equal('generation_not_enabled')
    })
  })

  describe('accepting a request', function () {
    it('answers with the opaque id IMMEDIATELY rather than the finished view', async function () {
      const ws = fake_socket()
      const watch = no_watch()
      const job = await handle_generation_request({
        ws,
        user_id: 1,
        payload: { instruction: 'top ten receivers by air yards' },
        watch
      })

      const accepted = ws.frames_of('DATA_VIEW_GENERATION_ACCEPTED')
      expect(accepted).to.have.lengthOf(1)
      expect(accepted[0].payload.generation_id).to.equal(job.generation_id)
      expect(accepted[0].payload.status).to.equal('queued')
      expect(accepted[0].payload.result).to.equal(null)
      expect(accepted[0].payload.max_queue_depth).to.equal(MAX_QUEUE_DEPTH)
      expect(watch.calls).to.have.lengthOf(1)
    })

    it('carries the current table_state through as the edit case', async function () {
      const ws = fake_socket()
      const job = await handle_generation_request({
        ws,
        user_id: 1,
        payload: {
          instruction: 'add air yards',
          table_state: { columns: ['player_name'] }
        },
        watch: no_watch()
      })
      const row = await db('data_view_generation_jobs')
        .where({ generation_id: job.generation_id })
        .first()
      expect(row.input_table_state).to.deep.equal({
        columns: ['player_name']
      })
    })

    it('refuses an empty instruction by name rather than queueing it', async function () {
      const ws = fake_socket()
      const job = await handle_generation_request({
        ws,
        user_id: 1,
        payload: { instruction: '   ' },
        watch: no_watch()
      })
      expect(job).to.equal(null)
      expect(ws.last().payload.error_code).to.equal('instruction_required')
    })

    it('reports the DEPTH when the queue refuses, not just a no', async function () {
      for (let i = 0; i < MAX_QUEUE_DEPTH; i++) {
        await enqueue_generation_job({ instruction: `job ${i}`, user_id: 1 })
      }
      const ws = fake_socket()
      const job = await handle_generation_request({
        ws,
        user_id: 1,
        payload: { instruction: 'one too many' },
        watch: no_watch()
      })
      expect(job).to.equal(null)
      expect(ws.last().payload.error_code).to.equal('queue_full')
      expect(ws.last().payload.queue_depth).to.equal(MAX_QUEUE_DEPTH)
      expect(ws.last().payload.max_queue_depth).to.equal(MAX_QUEUE_DEPTH)
    })
  })

  describe('reconnect and collect', function () {
    // THE CONTRACT THE OPAQUE ID EXISTS FOR. A client that disconnected
    // mid-run comes back holding only its generation_id and gets the view.
    it('serves a FINISHED view to a fresh socket holding only the id', async function () {
      const { generation_id } = await enqueue_generation_job({
        instruction: 'top receivers',
        user_id: 1
      })
      await complete_generation_job({
        generation_id,
        result: { expressible: true, table_state: { columns: ['x'] } },
        generation_branch: 'registry',
        trajectory: { tool_call_count: 6, total_tokens: 1200 }
      })

      const ws = fake_socket()
      const watch = no_watch()
      const job = await handle_generation_collect({
        ws,
        user_id: 1,
        payload: { generation_id },
        watch
      })

      expect(job.status).to.equal('completed')
      const frame = ws.frames_of('DATA_VIEW_GENERATION_UPDATE')[0]
      expect(frame.payload.result.table_state).to.deep.equal({
        columns: ['x']
      })
      expect(frame.payload.generation_branch).to.equal('registry')
      expect(frame.payload.tool_call_count).to.equal(6)
      // A finished job needs no watcher; starting one would poll a terminal row.
      expect(watch.calls).to.have.lengthOf(0)
    })

    it('resumes WATCHING a job that is still live', async function () {
      const { generation_id } = await enqueue_generation_job({
        instruction: 'top receivers',
        user_id: 1
      })
      const ws = fake_socket()
      const watch = no_watch()
      await handle_generation_collect({
        ws,
        user_id: 1,
        payload: { generation_id },
        watch
      })
      expect(watch.calls).to.have.lengthOf(1)
      expect(watch.calls[0].generation_id).to.equal(generation_id)
    })

    it("REFUSES another account's generation_id", async function () {
      const { generation_id } = await enqueue_generation_job({
        instruction: 'top receivers',
        user_id: 1
      })
      const ws = fake_socket()
      const job = await handle_generation_collect({
        ws,
        user_id: 2,
        payload: { generation_id },
        watch: no_watch()
      })
      expect(job).to.equal(null)
      expect(ws.last().payload.error_code).to.equal('generation_not_found')
    })

    it('answers an unknown id with the SAME refusal, so it is no existence oracle', async function () {
      const ws = fake_socket()
      await handle_generation_collect({
        ws,
        user_id: 1,
        payload: { generation_id: '00000000-0000-4000-8000-000000000000' },
        watch: no_watch()
      })
      expect(ws.last().payload.error_code).to.equal('generation_not_found')
    })

    it('refuses a collect with no id at all', async function () {
      const ws = fake_socket()
      await handle_generation_collect({
        ws,
        user_id: 1,
        payload: {},
        watch: no_watch()
      })
      expect(ws.last().payload.error_code).to.equal('generation_id_required')
    })
  })

  describe('the watch', function () {
    it('sends a frame on every status CHANGE and stops at a terminal state', async function () {
      const ws = fake_socket()
      const statuses = ['queued', 'queued', 'running', 'running', 'completed']
      let call = 0
      const read_job = async (generation_id) => ({
        generation_id,
        status: statuses[Math.min(call++, statuses.length - 1)],
        instruction: 'x',
        queued_at: new Date(),
        deadline_at: new Date()
      })

      await watch_generation_job({
        ws,
        generation_id: 'g1',
        read_job,
        interval_ms: 1
      })

      const updates = ws.frames_of('DATA_VIEW_GENERATION_UPDATE')
      // Three CHANGES across five reads, not five frames.
      expect(updates.map((frame) => frame.payload.status)).to.deep.equal([
        'queued',
        'running',
        'completed'
      ])
    })

    it('carries NO progress paraphrase on the job frame any more', async function () {
      // The retired mechanism, pinned as absent. It shipped a {step_count,
      // tool} pair that the client rendered as invented prose; the agent's real
      // timeline replaced it and a field nothing populates is worse than no
      // field.
      //
      // Anchored on the projection's OWN KEYS rather than on a value, because
      // `payload.progress_step_count` reads undefined both when the field is
      // gone and when it is present and null.
      const projected = project_generation_job({
        generation_id: 'g1',
        status: 'running',
        instruction: 'x',
        queued_at: new Date(),
        deadline_at: new Date()
      })
      expect(Object.keys(projected)).to.not.include('progress_step_count')
      expect(Object.keys(projected)).to.not.include('progress_tool')
    })

    it('sends a timeline BACKFILL on collect, carrying entry content', async function () {
      // The load-bearing assertion is on CONTENT, not on shape. base's REST
      // read fails by MASKING: a denied read returns 200 with the same entry
      // count, the same types, the same ordering and the same content lengths.
      // Asserting `entries.length > 0` would pass against a fully masked
      // timeline.
      const ws = fake_socket()
      const job = await enqueue_generation_job({
        instruction: 'timeline backfill',
        user_id: GENERATION_USER_ID
      })
      await db('data_view_generation_jobs')
        .where({ generation_id: job.generation_id })
        .update({ thread_id: 'thread-backfill', status: 'running' })

      await handle_generation_collect({
        ws,
        user_id: 1,
        payload: { generation_id: job.generation_id },
        watch: async () => {},
        read_timeline: async ({ thread_id }) => ({
          entries: [
            {
              id: 'e1',
              type: 'tool_call',
              content: `searched columns for ${thread_id}`,
              ordering: { timeline_index: 0, timeline_epoch: 1 }
            }
          ],
          timeline_window: { epoch: 1 },
          is_redacted: false
        })
      })

      const [backfill] = ws.frames_of('DATA_VIEW_GENERATION_TIMELINE_BACKFILL')
      expect(backfill, 'no backfill frame was sent').to.exist
      expect(backfill.payload.generation_id).to.equal(job.generation_id)
      expect(backfill.payload.entries[0].content).to.equal(
        'searched columns for thread-backfill'
      )
      expect(backfill.payload.is_redacted).to.equal(false)
    })

    it('sends NO backfill for a job that has no thread yet', async function () {
      // Every run's first seconds, between `queued` and `dispatched`. A read
      // issued here would be a request for a thread that does not exist.
      const ws = fake_socket()
      const job = await enqueue_generation_job({
        instruction: 'not dispatched',
        user_id: GENERATION_USER_ID
      })

      let read_calls = 0
      await handle_generation_collect({
        ws,
        user_id: 1,
        payload: { generation_id: job.generation_id },
        watch: async () => {},
        read_timeline: async () => {
          read_calls += 1
          return { entries: [], timeline_window: null, is_redacted: false }
        }
      })

      expect(read_calls).to.equal(0)
      expect(
        ws.frames_of('DATA_VIEW_GENERATION_TIMELINE_BACKFILL')
      ).to.have.length(0)
    })

    it('marks a MASKED backfill as redacted rather than as content', async function () {
      // The redaction hazard, and the reason it needs its own frame field: a
      // masked timeline is structurally identical to a real one, so nothing
      // else on the wire distinguishes a permission failure from a quiet run.
      const ws = fake_socket()
      const job = await enqueue_generation_job({
        instruction: 'masked',
        user_id: GENERATION_USER_ID
      })
      await db('data_view_generation_jobs')
        .where({ generation_id: job.generation_id })
        .update({ thread_id: 'thread-masked', status: 'running' })

      await handle_generation_collect({
        ws,
        user_id: 1,
        payload: { generation_id: job.generation_id },
        watch: async () => {},
        read_timeline: async () => ({
          entries: [
            {
              id: 'e1',
              type: 'tool_call',
              content: '████████',
              is_redacted: true,
              ordering: { timeline_index: 0 }
            }
          ],
          timeline_window: null,
          is_redacted: true
        })
      })

      const [backfill] = ws.frames_of('DATA_VIEW_GENERATION_TIMELINE_BACKFILL')
      expect(backfill.payload.is_redacted).to.equal(true)
      expect(backfill.payload.entries[0].is_redacted).to.equal(true)
    })

    it('does not fail a collect when the timeline cannot be read', async function () {
      // A timeline league cannot read is a degraded panel, never a failed
      // generation: status, result and trajectory all travel on the UPDATE
      // frame and are unaffected.
      const ws = fake_socket()
      const job = await enqueue_generation_job({
        instruction: 'unreadable timeline',
        user_id: GENERATION_USER_ID
      })
      await db('data_view_generation_jobs')
        .where({ generation_id: job.generation_id })
        .update({ thread_id: 'thread-broken', status: 'running' })

      const collected = await handle_generation_collect({
        ws,
        user_id: 1,
        payload: { generation_id: job.generation_id },
        watch: async () => {},
        read_timeline: async () => {
          throw new Error('base refused a timeline read with 500')
        }
      })

      expect(collected).to.exist
      expect(ws.frames_of('DATA_VIEW_GENERATION_UPDATE')).to.have.length(1)
      expect(
        ws.frames_of('DATA_VIEW_GENERATION_TIMELINE_BACKFILL')
      ).to.have.length(0)
    })

    it('relays a live timeline ENTRY onto the socket', async function () {
      const ws = fake_socket()
      let emit = null
      const stop = relay_timeline_entries({
        ws,
        generation_id: 'g-live',
        add_listener: ({ listener }) => {
          emit = listener
          return () => {
            emit = null
          }
        }
      })

      emit({
        id: 'e9',
        type: 'tool_result',
        content: 'ran the query',
        ordering: { timeline_index: 4 }
      })

      const [frame] = ws.frames_of('DATA_VIEW_GENERATION_TIMELINE_ENTRY')
      expect(frame.payload.generation_id).to.equal('g-live')
      expect(frame.payload.entry.content).to.equal('ran the query')

      // The unsubscribe must actually detach, or a closed browser socket keeps
      // receiving entries for the rest of the run.
      stop()
      expect(emit).to.equal(null)
    })

    it('names a vanished row rather than polling an empty result forever', async function () {
      const ws = fake_socket()
      await watch_generation_job({
        ws,
        generation_id: 'gone',
        read_job: async () => undefined,
        interval_ms: 1
      })
      expect(ws.last().payload.error_code).to.equal('generation_vanished')
    })

    it('STOPS on a disconnect, and the run is untouched', async function () {
      // The load-bearing asymmetry: a query dies with its socket, a generation
      // does not. What a close ends is the polling; the run keeps its own
      // deadline so the client can come back for it.
      const ws = fake_socket()
      const { generation_id } = await enqueue_generation_job({
        instruction: 'top receivers',
        user_id: 1
      })

      let reads = 0
      const read_job = async (id) => {
        reads += 1
        // Disconnect after the first read, the way a closing browser would.
        if (reads === 1) stop_generation_watchers(ws)
        return { generation_id: id, status: 'running', instruction: 'x' }
      }

      await watch_generation_job({
        ws,
        generation_id,
        read_job,
        interval_ms: 1
      })

      expect(reads).to.equal(1)
      const row = await db('data_view_generation_jobs')
        .where({ generation_id })
        .first()
      expect(row.status).to.equal('queued')
      expect(row.completed_at).to.equal(null)
    })

    it('stops when the socket is no longer open', async function () {
      const ws = fake_socket()
      ws.readyState = 3
      let reads = 0
      await watch_generation_job({
        ws,
        generation_id: 'g',
        read_job: async () => {
          reads += 1
          return { generation_id: 'g', status: 'running' }
        },
        interval_ms: 1
      })
      expect(reads).to.equal(0)
    })
  })

  describe('the projection', function () {
    it('withholds the rate-limit principal and the owner', function () {
      const projected = project_generation_job({
        generation_id: 'g',
        principal_key: 'ip:203.0.113.7',
        user_id: 1,
        status: 'queued',
        instruction: 'x',
        queued_at: 'now',
        deadline_at: 'later'
      })
      expect(projected).to.not.have.property('principal_key')
      expect(projected).to.not.have.property('user_id')
    })
  })
})
