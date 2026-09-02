/* global describe before beforeEach afterEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import users from '#db/fixtures/users.mjs'
import { current_season } from '#constants'
import handle_external_league_import_socket, {
  MESSAGE_TYPES
} from '#api/sockets/external-league-import.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

// `cancel_job` in libs-server/external-fantasy-leagues/queue/import-queue.mjs
// is the authorization decision under test: it refuses unless the requester IS
// the job's `initiated_by`. That comparison is only worth anything if the
// identity it reads cannot be chosen by the caller, so these specs drive the
// socket ROUTER -- which is where the identity is bound -- and never call
// `cancel_job` directly. A spec that called it would supply both sides of the
// comparison itself and could not observe where either came from.
const OWNER_USER_ID = 2
const OTHER_USER_ID = 3

// `job_id` and `connection_id` are uuid columns, so the ids are spelled as
// uuids rather than as readable slugs.
const OWNED_JOB_ID = '11111111-1111-4111-8111-111111111111'
const FOREIGN_JOB_ID = '22222222-2222-4222-8222-222222222222'
const CONNECTION_ID = '33333333-3333-4333-8333-333333333333'

const make_socket = () => {
  const sent = []
  return {
    sent,
    readyState: 1,
    send: (payload) => sent.push(JSON.parse(payload)),
    errors: () =>
      sent
        .filter(
          (event) => event.type === MESSAGE_TYPES.EXTERNAL_LEAGUE_IMPORT_ERROR
        )
        .map((event) => event.payload.error)
  }
}

const seed_job = async ({ job_id, initiated_by }) => {
  await knex('external_league_import_jobs').insert({
    job_id,
    connection_id: CONNECTION_ID,
    lid: 1,
    job_type: 'full_sync',
    status: 'queued',
    initiated_by,
    created_at: new Date(),
    updated_at: new Date()
  })
}

const job_status = async (job_id) => {
  const [row] = await knex('external_league_import_jobs').where({ job_id })
  return row ? row.status : null
}

describe('external league import socket identity', function () {
  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(
      current_season.regular_season_start.subtract('1', 'month').toISOString()
    )
    await knex.seed.run()
    // `external_league_import_jobs.initiated_by` is a foreign key into `users`,
    // and the ownership check compares against it -- so both identities in
    // these specs have to be real user rows.
    await users(knex)
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    // The league fixture supplies the lid both tables reference; the connection
    // is the jobs table's own foreign key.
    await league(knex)
    await knex('external_league_import_jobs').del()
    await knex('external_league_connections').del()
    await knex('external_league_connections').insert({
      connection_id: CONNECTION_ID,
      lid: 1,
      platform: 'sleeper',
      external_league_id: 'ext-1',
      connection_name: 'test connection',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    })
  })

  afterEach(async function () {
    await knex('external_league_import_jobs').del()
    await knex('external_league_connections').del()
  })

  it('cancels a job for the user who initiated it', async function () {
    // THE CONTROL, and the refusal below is worthless without it: it separates
    // "the ownership check refused this caller" from "the router stopped
    // cancelling anything".
    this.timeout(60 * 1000)
    await seed_job({ job_id: OWNED_JOB_ID, initiated_by: OWNER_USER_ID })

    const ws = make_socket()
    await handle_external_league_import_socket(
      ws,
      {
        type: MESSAGE_TYPES.CANCEL_SYNC_JOB,
        payload: { job_id: OWNED_JOB_ID }
      },
      OWNER_USER_ID
    )

    expect(ws.errors(), 'the initiator may cancel their own job').to.deep.equal(
      []
    )
    expect(await job_status(OWNED_JOB_ID)).to.equal('cancelled')
  })

  it('refuses to cancel another user job whose initiator the payload names', async function () {
    // The payload carries the job's OWN `initiated_by` -- the exact value the
    // ownership check compares against, and one anybody who can see the job can
    // read. Taken from the payload, the check compares client input against a
    // value the same client supplied and passes; the refusal has to come from
    // the authenticated session instead.
    this.timeout(60 * 1000)
    await seed_job({ job_id: FOREIGN_JOB_ID, initiated_by: OWNER_USER_ID })

    const ws = make_socket()
    await handle_external_league_import_socket(
      ws,
      {
        type: MESSAGE_TYPES.CANCEL_SYNC_JOB,
        payload: { job_id: FOREIGN_JOB_ID, user_id: OWNER_USER_ID }
      },
      OTHER_USER_ID
    )

    expect(
      await job_status(FOREIGN_JOB_ID),
      'a user who did not initiate the job did not cancel it'
    ).to.equal('queued')
    expect(ws.errors()).to.include('Unauthorized to cancel this job')
  })
})
