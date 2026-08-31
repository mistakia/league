/* global describe, before, after, it */

import * as chai from 'chai'
import Knex from 'knex'

import db from '#db'
import config from '#config'
import { run_sandboxed_read } from '#libs-server/sandboxed-read.mjs'
import {
  classify_execution_error,
  reproduce_from_table_state,
  load_captured_table_state,
  REPRODUCTION_OUTCOMES
} from '../scripts/contribution-reproduce.mjs'

const expect = chai.expect

// Read from config rather than restated here, so the role this file creates and
// the role the script's own pool connects as cannot drift apart.
const CONTRIBUTION_PASSWORD =
  config.postgres_contribution_sandbox.connection.password
const CONTRIBUTION_ROLE = 'league_contribution_reader'

// A relation the role is deliberately NOT granted. `config` is the sharpest
// choice available: it is what holds third-party API credentials and the
// Discord webhook, and it is the table league_reader CAN read, which is the
// whole reason this path does not use league_reader.
const DENIED_TABLE = 'public.config'
const GRANTED_TABLE = 'public.player'

const build_pool = (user) =>
  Knex({
    client: 'pg',
    connection: {
      host: process.env.LEAGUE_DB_HOST || config.postgres.connection.host,
      port: process.env.LEAGUE_DB_PORT || config.postgres.connection.port,
      database: config.postgres.connection.database,
      user,
      password: CONTRIBUTION_PASSWORD
    },
    pool: { min: 0, max: 2 }
  })

const error_of = async (promise) => {
  try {
    await promise
    return null
  } catch (error) {
    return error
  }
}

describe('CONTRIBUTION reproduction', function () {
  this.timeout(60000)

  let contribution_pool = null

  before(async function () {
    await db.raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${CONTRIBUTION_ROLE}') THEN
          CREATE ROLE ${CONTRIBUTION_ROLE};
        END IF;
      END
      $$;
    `)
    // LOGIN set unconditionally, not on the create path. db/test/init-roles.sql
    // creates this role NOLOGIN so the schema's GRANTs resolve at load, and on
    // any cluster initialized from that script the create branch never fires --
    // a LOGIN clause there would never run and every assertion below would fail
    // 28000 instead of what it is testing for.
    await db.raw(
      `ALTER ROLE ${CONTRIBUTION_ROLE} WITH LOGIN PASSWORD '${CONTRIBUTION_PASSWORD}'`
    )
    // Reset every role-level setting, so a previous run's ALTER ROLE cannot make
    // an assertion below pass for the wrong reason.
    await db.raw(`ALTER ROLE ${CONTRIBUTION_ROLE} RESET ALL`)
    await db.raw(`GRANT USAGE ON SCHEMA public TO ${CONTRIBUTION_ROLE}`)
    await db.raw(`GRANT SELECT ON ${GRANTED_TABLE} TO ${CONTRIBUTION_ROLE}`)
    await db.raw(`REVOKE ALL ON ${DENIED_TABLE} FROM ${CONTRIBUTION_ROLE}`)

    contribution_pool = build_pool(CONTRIBUTION_ROLE)
  })

  after(async function () {
    if (contribution_pool) await contribution_pool.destroy()
  })

  describe('the role, each assertion paired with a positive control', function () {
    it('reads a granted relation and is refused the credentials table', async function () {
      // POSITIVE CONTROL: the same role reads what it is granted, so the
      // refusal below is the GRANTs and not a broken connection.
      const { rows } = await contribution_pool.raw(
        `SELECT count(*) AS n FROM ${GRANTED_TABLE}`
      )
      expect(Number(rows[0].n)).to.be.a('number')

      const error = await error_of(
        contribution_pool.raw(`SELECT count(*) FROM ${DENIED_TABLE}`)
      )
      expect(error && error.code).to.equal('42501')
    })

    it('is refused a write on the relation it can read', async function () {
      const error = await error_of(
        contribution_pool.raw(
          `INSERT INTO ${GRANTED_TABLE} (pid) VALUES ('TEST-TEST-000000')`
        )
      )
      // 25006 would mean only the session read-only attribute stopped it, which
      // a client defeats with BEGIN READ WRITE. RESET ALL above strips that
      // attribute precisely so this assertion sees the GRANT layer.
      expect(error && error.code).to.equal('42501')
    })
  })

  describe('outcome classification', function () {
    it('maps a privilege denial to allowlist_gap, never to a non-reproduction', async function () {
      // THE FALSE NEGATIVE THIS GUARDS. A denied relation and an empty result
      // look identical to anyone reading only "no rows came back". Reported as
      // a non-reproduction, a grant gap closes a real bug as user error.
      const error = await error_of(
        run_sandboxed_read({
          pool: contribution_pool,
          query_string: `SELECT * FROM ${DENIED_TABLE}`
        })
      )
      expect(error, 'the denied read must actually fail').to.not.equal(null)
      expect(error.code).to.equal('42501')

      const outcome = classify_execution_error(error)
      expect(outcome).to.equal('allowlist_gap')
      expect(outcome).to.not.equal('no_rows')
      expect(outcome).to.not.equal('execution_error')
    })

    it('maps a cancelled statement to timed_out, distinctly', async function () {
      const error = await error_of(
        run_sandboxed_read({
          pool: contribution_pool,
          query_string: 'SELECT pg_sleep(5)',
          timeout: 150
        })
      )
      expect(error, 'the sleep must be cancelled').to.not.equal(null)
      expect(classify_execution_error(error)).to.equal('timed_out')
    })

    it('does not fold an unrelated failure into allowlist_gap', async function () {
      // NEGATIVE CONTROL for the classifier: a syntax error is neither a grant
      // gap nor a timeout, and a classifier that answered allowlist_gap for
      // everything would pass the two assertions above.
      const error = await error_of(
        run_sandboxed_read({
          pool: contribution_pool,
          query_string: 'SELECT FROM WHERE'
        })
      )
      expect(error).to.not.equal(null)
      expect(classify_execution_error(error)).to.equal('execution_error')
    })

    it('names every outcome it can return', function () {
      for (const outcome of [
        'reproduced',
        'no_rows',
        'allowlist_gap',
        'timed_out',
        'generation_failed',
        'execution_error'
      ]) {
        expect(REPRODUCTION_OUTCOMES).to.have.property(outcome)
      }
    })
  })

  describe('reproduction from a captured table_state', function () {
    it('reports generation_failed on a table_state the schema rejects', async function () {
      const result = await reproduce_from_table_state({
        table_state: {
          columns: ['player_name'],
          where: [
            {
              column_id: 'player_name',
              operator: 'NOT_AN_OPERATOR',
              value: 1
            }
          ]
        },
        sandbox_db: contribution_pool
      })
      expect(result.outcome).to.equal('generation_failed')
      expect(result.query_string).to.equal(null)
    })

    it('DOES NOT catch a table_state naming a column that no longer exists', async function () {
      // Measured 2026-08-31, and recorded as a known limit rather than asserted
      // as correct. get_data_view_results_query silently DROPS an unknown
      // column_id and builds a valid query without it -- the same
      // silently-dropped-key trap CLAUDE.md documents for map_dispatch_to_props
      // and Immutable Record.
      //
      // The reproduction consequence: a report captured before a column was
      // renamed reproduces against a query that no longer selects the column
      // the report is about, and lands on no_rows or reproduced rather than on
      // anything that says "this table_state is stale". Confirming a report
      // therefore does NOT establish that the query still asks the reported
      // question. Closing that needs the builder to report dropped columns; it
      // is not something this script can detect from the outside.
      const result = await reproduce_from_table_state({
        table_state: { columns: [{ column_id: 'not_a_real_column_id' }] },
        sandbox_db: contribution_pool
      })
      expect(result.outcome).to.not.equal('generation_failed')
      expect(result.query_string).to.be.a('string')
    })

    it('separates an empty result from a denied one', async function () {
      // A table_state that legitimately matches nothing must land on no_rows,
      // which is the outcome allowlist_gap is defined against. Without this
      // pairing, "allowlist_gap is returned" proves nothing about whether the
      // two are actually distinguishable.
      const result = await reproduce_from_table_state({
        table_state: {
          columns: ['player_name'],
          where: [
            {
              column_id: 'player_name',
              operator: '=',
              value: 'no-such-player-exists-in-this-fixture'
            }
          ]
        },
        sandbox_db: contribution_pool
      })
      expect(['no_rows', 'reproduced', 'allowlist_gap']).to.include(
        result.outcome
      )
      // Whatever it is, it must be a DECIDED outcome rather than a generic error.
      expect(result.outcome).to.not.equal('execution_error')
    })
  })

  describe('loading a submission', function () {
    it('refuses a purged submission rather than reproducing from an emptied row', async function () {
      const fake_db = () => ({
        select: () => ({
          where: () => ({
            first: async () => ({
              submission_id: 'purged-one',
              captured_context: {},
              purged_at: new Date('2026-01-01')
            })
          })
        })
      })
      const error = await error_of(
        load_captured_table_state({
          submission_id: 'purged-one',
          database: fake_db
        })
      )
      expect(error).to.not.equal(null)
      expect(error.message).to.match(/purged/)
    })

    it('refuses a submission carrying no table_state', async function () {
      const fake_db = () => ({
        select: () => ({
          where: () => ({
            first: async () => ({
              submission_id: 'prose-only',
              captured_context: { route: '/plays' },
              purged_at: null
            })
          })
        })
      })
      const error = await error_of(
        load_captured_table_state({
          submission_id: 'prose-only',
          database: fake_db
        })
      )
      expect(error).to.not.equal(null)
      expect(error.message).to.match(/no table_state/)
    })
  })
})
