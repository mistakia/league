/* global describe, before, after, it */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import * as chai from 'chai'
import Knex from 'knex'

import db from '#db'
import config from '#config'
import execute_generated_sql from '#libs-server/data-views/generation/execute-generated-sql.mjs'
import {
  is_data_view_sql_enabled,
  assert_data_view_sql_enabled
} from '#libs-server/data-views/generation/data-view-sql-kill-switch.mjs'

const expect = chai.expect

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Read from config rather than restated here, so the role this file creates and
// the role the executor's own pool connects as cannot drift apart. The value is
// a throwaway-container credential, the same tier as the league_test one beside
// it in config-test.json.
const SANDBOX_PASSWORD = config.postgres_data_view_sandbox.connection.password
const SANDBOX_ROLE = 'league_data_view_reader'
// The role that is missing the three hardening lines. Every hardening assertion
// below is paired against it, because a test that never shows the attack working
// proves nothing about the guard.
const UNHARDENED_ROLE = 'sandbox_control_unhardened'

const VICTIM_TABLE = 'sandbox_positive_control_victim'
const LATE_TABLE = 'sandbox_created_after_the_grant'

const build_pool = (user) =>
  Knex({
    client: 'pg',
    connection: {
      host: process.env.LEAGUE_DB_HOST || config.postgres.connection.host,
      port: process.env.LEAGUE_DB_PORT || config.postgres.connection.port,
      database: config.postgres.connection.database,
      user,
      password: SANDBOX_PASSWORD
    },
    pool: { min: 0, max: 2 }
  })

const error_code_of = async (promise) => {
  try {
    await promise
    return null
  } catch (error) {
    return error.code || error.message
  }
}

describe('DATA VIEW SQL sandbox', function () {
  this.timeout(60000)

  let sandbox_pool = null
  let unhardened_pool = null
  const audit_rows = []
  const audit_writer = () => ({
    insert: async (row) => {
      audit_rows.push(row)
    }
  })

  before(async function () {
    await db.raw(`DROP TABLE IF EXISTS ${VICTIM_TABLE}`)
    await db.raw(`DROP TABLE IF EXISTS ${LATE_TABLE}`)
    await db.raw(`CREATE TABLE ${VICTIM_TABLE} (id integer)`)
    await db.raw(`INSERT INTO ${VICTIM_TABLE} (id) VALUES (1)`)

    for (const role of [SANDBOX_ROLE, UNHARDENED_ROLE]) {
      await db.raw(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${role}') THEN
            CREATE ROLE ${role} LOGIN;
          END IF;
        END
        $$;
      `)
      // LOGIN is set here, not on the CREATE above, because the CREATE only
      // fires when the role is absent. db/test/init-roles.sql now creates
      // league_data_view_reader NOLOGIN so the schema's GRANTs can load, so on
      // any cluster initialized from that script the branch above is skipped and
      // a LOGIN clause there never runs -- every assertion below then fails
      // 28000 (cannot log in) instead of the 42501 it is testing for.
      await db.raw(
        `ALTER ROLE ${role} WITH LOGIN PASSWORD '${SANDBOX_PASSWORD}'`
      )
      // Reset every role-level setting, so a previous run's ALTER ROLE cannot
      // make an assertion below pass for the wrong reason.
      await db.raw(`ALTER ROLE ${role} RESET ALL`)
      await db.raw(`GRANT USAGE ON SCHEMA public TO ${role}`)
      await db.raw(`GRANT SELECT ON public.player TO ${role}`)
      await db.raw(`GRANT SELECT ON public.nfl_plays TO ${role}`)
      await db.raw(`GRANT SELECT ON ${VICTIM_TABLE} TO ${role}`)
    }

    // The unhardened control keeps INSERT on the victim table. That is what
    // isolates the READ ONLY transaction as the control in the write test below:
    // without it, a refused INSERT would only prove the role lacks the grant.
    await db.raw(`GRANT INSERT ON ${VICTIM_TABLE} TO ${UNHARDENED_ROLE}`)

    // Restore the PUBLIC privileges the hardening REVOKEs remove, so this file
    // starts from the same state as a cluster that has never been hardened and
    // the positive controls below are meaningful.
    await db.raw('GRANT TEMP ON DATABASE league_test TO PUBLIC')
    await db.raw(
      'GRANT EXECUTE ON FUNCTION lo_from_bytea(oid, bytea) TO PUBLIC'
    )

    sandbox_pool = build_pool(SANDBOX_ROLE)
    unhardened_pool = build_pool(UNHARDENED_ROLE)

    // The audit table's DDL, applied from the same adhoc file that will be run
    // against production. Executing it here also proves the file parses before
    // it reaches the live database.
    const audit_ddl = fs.readFileSync(
      path.join(
        __dirname,
        '..',
        'db',
        'adhoc',
        '2026-08-28-data-view-sql-audit.sql'
      ),
      'utf8'
    )
    await db.raw('DROP TABLE IF EXISTS public.data_view_sql_audit')
    await db.raw(audit_ddl)
  })

  after(async function () {
    if (sandbox_pool) await sandbox_pool.destroy()
    if (unhardened_pool) await unhardened_pool.destroy()
    await db.raw(`DROP TABLE IF EXISTS ${VICTIM_TABLE}`)
    await db.raw(`DROP TABLE IF EXISTS ${LATE_TABLE}`)
  })

  describe('the role, each assertion paired with a positive control', function () {
    it('reads an allowlisted table and is refused a non-granted one', async function () {
      const { rows } = await sandbox_pool.raw(
        'SELECT count(*) AS n FROM player'
      )
      expect(Number(rows[0].n)).to.be.a('number')

      // POSITIVE CONTROL: the superuser connection reads the same table freely,
      // so the refusal below is the GRANTs and not a missing table.
      const { rows: control_rows } = await db.raw(
        'SELECT count(*) AS n FROM users'
      )
      expect(Number(control_rows[0].n)).to.be.a('number')

      expect(
        await error_code_of(sandbox_pool.raw('SELECT count(*) FROM users'))
      ).to.equal('42501')
    })

    it('is refused a table created AFTER its grants', async function () {
      await db.raw(`CREATE TABLE ${LATE_TABLE} (id integer)`)

      // POSITIVE CONTROL: the standing ALTER DEFAULT PRIVILEGES grant is what
      // this role must NOT have. league_reader carries the equivalent in
      // production; here the control is that the table plainly exists and the
      // superuser reads it.
      const { rows } = await db.raw(`SELECT count(*) AS n FROM ${LATE_TABLE}`)
      expect(Number(rows[0].n)).to.equal(0)

      expect(
        await error_code_of(sandbox_pool.raw(`SELECT * FROM ${LATE_TABLE}`))
      ).to.equal('42501')
    })

    it('is not a superuser', async function () {
      const { rows } = await sandbox_pool.raw(
        "SELECT current_setting('is_superuser') AS flag"
      )
      expect(rows[0].flag).to.equal('off')
    })

    it('cannot INSERT even where it can SELECT', async function () {
      // POSITIVE CONTROL: the unhardened role HAS the INSERT grant and the
      // insert succeeds, so the refusal is about privileges rather than about
      // the statement being malformed.
      await unhardened_pool.raw(`INSERT INTO ${VICTIM_TABLE} (id) VALUES (99)`)
      const { rows } = await db.raw(
        `SELECT count(*) AS n FROM ${VICTIM_TABLE} WHERE id = 99`
      )
      expect(Number(rows[0].n)).to.equal(1)

      expect(
        await error_code_of(
          sandbox_pool.raw(`INSERT INTO ${VICTIM_TABLE} (id) VALUES (100)`)
        )
      ).to.equal('42501')
    })

    it('REVOKE TEMP closes CREATE TEMP TABLE, which no SELECT grant touches', async function () {
      // POSITIVE CONTROL, run BEFORE the revoke: TEMP is granted to PUBLIC and
      // the sandbox role can fill the disk with temp tables. temp_file_limit
      // bounds sort spill, not this.
      await sandbox_pool.raw(
        'CREATE TEMP TABLE sandbox_temp_control (id integer)'
      )
      await sandbox_pool.raw('DROP TABLE sandbox_temp_control')

      await db.raw('REVOKE TEMP ON DATABASE league_test FROM PUBLIC')

      const code = await error_code_of(
        sandbox_pool.raw('CREATE TEMP TABLE sandbox_temp_after (id integer)')
      )
      expect(code).to.equal('42501')
    })

    it('REVOKE EXECUTE closes the large-object write functions', async function () {
      // POSITIVE CONTROL: lo_from_bytea carries PUBLIC EXECUTE by default and
      // writes a large object, which is the second unbounded write class.
      const { rows } = await sandbox_pool.raw(
        "SELECT lo_from_bytea(0, 'control'::bytea) AS loid"
      )
      expect(Number(rows[0].loid)).to.be.greaterThan(0)
      await db.raw(`SELECT lo_unlink(${Number(rows[0].loid)})`)

      await db.raw(
        'REVOKE EXECUTE ON FUNCTION lo_from_bytea(oid, bytea) FROM PUBLIC'
      )

      const code = await error_code_of(
        sandbox_pool.raw("SELECT lo_from_bytea(0, 'after'::bytea)")
      )
      expect(code).to.equal('42501')
    })

    it('ALTER ROLE makes a fresh session read-only before any BEGIN', async function () {
      // POSITIVE CONTROL: the unhardened role carries no rolconfig, and its
      // fresh session is read-WRITE.
      const { rows: control_rows } = await unhardened_pool.raw(
        "SELECT current_setting('transaction_read_only') AS flag"
      )
      expect(control_rows[0].flag).to.equal('off')

      await db.raw(
        `ALTER ROLE ${SANDBOX_ROLE} SET default_transaction_read_only = on`
      )
      await sandbox_pool.destroy()
      sandbox_pool = build_pool(SANDBOX_ROLE)

      const { rows } = await sandbox_pool.raw(
        "SELECT current_setting('transaction_read_only') AS flag"
      )
      expect(rows[0].flag).to.equal('on')
    })
  })

  describe('the read-only transaction', function () {
    it('SET TRANSACTION READ ONLY blocks a write the role is otherwise granted', async function () {
      // POSITIVE CONTROL: same role, same statement, no READ ONLY wrapper --
      // the write lands.
      await unhardened_pool.transaction(async (trx) => {
        await trx.raw(`INSERT INTO ${VICTIM_TABLE} (id) VALUES (201)`)
      })
      const { rows } = await db.raw(
        `SELECT count(*) AS n FROM ${VICTIM_TABLE} WHERE id = 201`
      )
      expect(Number(rows[0].n)).to.equal(1)

      const code = await error_code_of(
        unhardened_pool.transaction(async (trx) => {
          await trx.raw('SET TRANSACTION READ ONLY')
          await trx.raw(`INSERT INTO ${VICTIM_TABLE} (id) VALUES (202)`)
        })
      )
      expect(code).to.equal('25006')
    })

    it('SET LOCAL default_transaction_read_only is NOT the control -- measured no-op', async function () {
      // This is why the executor issues SET TRANSACTION READ ONLY. The setting
      // only applies at transaction START, so setting it inside a BEGIN leaves
      // transaction_read_only at off and the write succeeds. Recorded as a test
      // because the wrong one of these two reads as correct in review.
      await unhardened_pool.transaction(async (trx) => {
        await trx.raw('SET LOCAL default_transaction_read_only = on')
        const { rows } = await trx.raw(
          "SELECT current_setting('transaction_read_only') AS flag"
        )
        expect(rows[0].flag).to.equal('off')
        await trx.raw(`INSERT INTO ${VICTIM_TABLE} (id) VALUES (203)`)
      })
      const { rows } = await db.raw(
        `SELECT count(*) AS n FROM ${VICTIM_TABLE} WHERE id = 203`
      )
      expect(Number(rows[0].n)).to.equal(1)
    })
  })

  describe('multi-statement injection', function () {
    it('the simple protocol executes every statement in the string', async function () {
      // POSITIVE CONTROL for the parser's single-statement rule: this is the
      // measured attack. `pg.query(sql, [])` with an empty values array stays on
      // the simple protocol, so the second statement runs.
      await db.raw(`CREATE TABLE ${LATE_TABLE}_victim (id integer)`)
      await db.raw(`SELECT 1; DROP TABLE ${LATE_TABLE}_victim`)
      const { rows } = await db.raw(
        `SELECT to_regclass('${LATE_TABLE}_victim') AS present`
      )
      expect(rows[0].present).to.equal(null)
    })

    it('the guard refuses the same string before it reaches Postgres', async function () {
      const code = await error_code_of(
        execute_generated_sql({
          sql_text: 'select pid as a from player; drop table player',
          sandbox_db: sandbox_pool,
          audit_writer
        })
      )
      expect(code).to.equal('multi_statement')

      const { rows } = await db.raw("SELECT to_regclass('player') AS present")
      expect(rows[0].present).to.not.equal(null)
    })
  })

  describe('the executor', function () {
    it('runs inside a read-only transaction, asserted on the session variable', async function () {
      const result = await execute_generated_sql({
        sql_text: "select current_setting('transaction_read_only') as flag",
        sandbox_db: sandbox_pool,
        audit_writer
      })
      expect(result.data_view_results[0].flag).to.equal('on')
    })

    it('truncates at the row cap', async function () {
      const result = await execute_generated_sql({
        sql_text: 'select generate_series(1, 5000) as n',
        limit: 25,
        sandbox_db: sandbox_pool,
        audit_writer
      })
      expect(result.data_view_results).to.have.length(25)
      // The window total counts the whole result set, before LIMIT.
      expect(result.data_view_metadata.total_count).to.equal(5000)
    })

    it('returns one field descriptor per projected column, in projection order', async function () {
      const result = await execute_generated_sql({
        sql_text: "select 1 as first_column, 'x' as second_column",
        sandbox_db: sandbox_pool,
        audit_writer
      })
      expect(result.data_view_fields.map((field) => field.name)).to.deep.equal([
        'first_column',
        'second_column'
      ])
      // The reserved total-count descriptor is stripped alongside the row key.
      // Missing that is an off-by-one on every total-counted query.
      expect(result.data_view_fields).to.have.length(
        Object.keys(result.data_view_results[0]).length
      )
    })

    it('returns descriptors for a UNION as the outermost node', async function () {
      const result = await execute_generated_sql({
        sql_text: 'select 1 as n union all select 2 as n',
        sandbox_db: sandbox_pool,
        audit_writer
      })
      expect(result.data_view_fields.map((field) => field.name)).to.deep.equal([
        'n'
      ])
      expect(result.data_view_results).to.have.length(2)
    })

    it('resolves an EXPRESSION column to a data_type, which information_schema cannot', async function () {
      const result = await execute_generated_sql({
        sql_text:
          'select count(*) as counted, 1 + 1 as summed, ' +
          "case when true then 'yes' else 'no' end as branched from player",
        sandbox_db: sandbox_pool,
        audit_writer
      })
      const by_name = Object.fromEntries(
        result.data_view_fields.map((field) => [field.name, field])
      )
      expect(by_name.counted.pg_type_name).to.equal('bigint')
      expect(by_name.counted.data_type).to.equal(1) // NUMBER
      expect(by_name.summed.data_type).to.equal(1)
      expect(by_name.branched.data_type).to.equal(2) // TEXT
    })

    it('sorts and filters through the outer wrapper on an inner UNION', async function () {
      const result = await execute_generated_sql({
        sql_text:
          'select 3 as n union all select 1 as n union all select 2 as n',
        sort: [{ column_id: 'n', desc: true }],
        where: [{ column_id: 'n', operator: '>=', value: 2 }],
        sandbox_db: sandbox_pool,
        audit_writer
      })
      expect(result.data_view_results.map((row) => row.n)).to.deep.equal([3, 2])
    })

    it('sorts through the wrapper on a statement carrying its own ORDER BY ... LIMIT', async function () {
      const result = await execute_generated_sql({
        sql_text:
          'select n as n from (select 1 as n union all select 2 as n ' +
          'union all select 3 as n) inner_query order by n desc limit 2',
        sort: [{ column_id: 'n', desc: false }],
        sandbox_db: sandbox_pool,
        audit_writer
      })
      expect(result.data_view_results.map((row) => row.n)).to.deep.equal([2, 3])
    })

    it('cancels a statement past its timeout', async function () {
      const code = await error_code_of(
        execute_generated_sql({
          sql_text: 'select pg_sleep(5) as slept',
          timeout: 250,
          sandbox_db: sandbox_pool,
          audit_writer
        })
      )
      // 57014 is query_canceled, carried up by the wrapper as its own code.
      expect(code).to.equal('57014')
    })

    it('two distinct statements at the same offset and limit return their own rows', async function () {
      // The cache-key collision this tier ships around: get_data_view_hash knows
      // nothing about SQL, so these two would share a key. Caching is OFF here,
      // so each returns itself.
      const first = await execute_generated_sql({
        sql_text: 'select 111 as n',
        offset: 0,
        limit: 500,
        sandbox_db: sandbox_pool,
        audit_writer
      })
      const second = await execute_generated_sql({
        sql_text: 'select 222 as n',
        offset: 0,
        limit: 500,
        sandbox_db: sandbox_pool,
        audit_writer
      })
      expect(first.data_view_results[0].n).to.equal(111)
      expect(second.data_view_results[0].n).to.equal(222)
    })
  })

  describe('the audit trail', function () {
    it('records one row for an executed statement and one for a rejection', async function () {
      await execute_generated_sql({
        sql_text: 'select 7 as n',
        sandbox_db: sandbox_pool,
        audit_writer: () => db('data_view_sql_audit')
      })

      try {
        await execute_generated_sql({
          sql_text: 'select id from users',
          sandbox_db: sandbox_pool,
          audit_writer: () => db('data_view_sql_audit')
        })
      } catch (error) {
        expect(error.code).to.equal('relation_not_allowlisted')
      }

      const rows = await db('data_view_sql_audit').orderBy('audit_id')
      const outcomes = rows.map((row) => row.outcome)
      expect(outcomes).to.include('executed')
      expect(outcomes).to.include('rejected')

      const executed = rows.find((row) => row.outcome === 'executed')
      expect(executed.result_row_count).to.equal(1)
      expect(executed.duration_milliseconds).to.be.a('number')
      expect(executed.statement_text).to.equal('select 7 as n')

      const rejected = rows.find((row) => row.outcome === 'rejected')
      expect(rejected.outcome_detail).to.equal('relation_not_allowlisted')
    })
  })

  describe('the kill switch', function () {
    it('is enabled when the Redis key is absent', async function () {
      expect(
        await is_data_view_sql_enabled({ cache_get: async () => null })
      ).to.equal(true)
    })

    it('is disabled when the Redis key says so', async function () {
      expect(
        await is_data_view_sql_enabled({
          cache_get: async () => ({ enabled: false })
        })
      ).to.equal(false)
    })

    it('refuses to execute a saved view when the environment kill switch is set', async function () {
      // POSITIVE CONTROL: the same statement runs with the switch clear.
      const before_switch = await execute_generated_sql({
        sql_text: 'select 1 as n',
        sandbox_db: sandbox_pool,
        audit_writer
      })
      expect(before_switch.data_view_results).to.have.length(1)

      process.env.LEAGUE_DATA_VIEW_SQL_DISABLED = '1'
      try {
        const code = await error_code_of(
          execute_generated_sql({
            sql_text: 'select 1 as n',
            sandbox_db: sandbox_pool,
            audit_writer
          })
        )
        expect(code).to.equal('data_view_sql_disabled')
        expect(await error_code_of(assert_data_view_sql_enabled())).to.equal(
          'data_view_sql_disabled'
        )
      } finally {
        delete process.env.LEAGUE_DATA_VIEW_SQL_DISABLED
      }
    })
  })
})
