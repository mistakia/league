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

  before(async function () {
    const exists = await db.schema.hasTable('data_view_generation_jobs')
    expect(
      exists,
      'data_view_generation_jobs exists -- apply db/adhoc/2026-09-02-create-data-view-generation-jobs.sql'
    ).to.equal(true)
  })

  beforeEach(async function () {
    await db('data_view_generation_jobs').del()
  })

  describe('admission', function () {
    it('requires authentication at launch', function () {
      expect(require_generation_principal(null).admitted).to.equal(false)
      expect(require_generation_principal(null).error_code).to.equal(
        'authentication_required'
      )
    })

    it('admits a signed-in account', function () {
      expect(require_generation_principal(7).admitted).to.equal(true)
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
