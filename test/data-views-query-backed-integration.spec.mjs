/* global describe, before, after, beforeEach, it */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import * as chai from 'chai'
import * as table_constants from 'react-table/src/constants.mjs'

import db from '#db'
import config from '#config'
import { destroy_sandbox_db } from '#db/sandbox-pool.mjs'
import { create_data_view_query } from '#scripts/create-data-view-query.mjs'
import run_query_backed_view from '#libs-server/data-views/run-query-backed-view.mjs'
import { execute_data_view_request } from '#libs-server/data-views/execute-data-view-request.mjs'

process.env.NODE_ENV = 'test'

const expect = chai.expect
const { TABLE_DATA_TYPES } = table_constants
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SANDBOX_PASSWORD = config.postgres_data_view_sandbox.connection.password
const SANDBOX_ROLE = 'league_data_view_reader'

// The whole representation, end to end, with NO LLM anywhere in it -- which is
// the claim the query-backed design rests on and which nothing else in the
// suite tests. A hand-written statement goes through the guard, the executor,
// the pg type resolver, the deriver and the persistence, and then comes back out
// through the render path a browser would take.
//
// It runs against the real database on the real sandbox role. A version of this
// with a stubbed executor would assert that the modules call each other, which
// is the one thing that was never in doubt.

describe('data views -- query backed, end to end', function () {
  this.timeout(60000)

  before(async function () {
    // Mirrors the setup in data-view-sql-sandbox.spec.mjs: the role exists
    // NOLOGIN from db/test/init-roles.sql so the schema's GRANTs can load, so
    // LOGIN and the password are set here rather than on a CREATE that will not
    // fire.
    await db.raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${SANDBOX_ROLE}') THEN
          CREATE ROLE ${SANDBOX_ROLE} LOGIN;
        END IF;
      END
      $$;
    `)
    await db.raw(
      `ALTER ROLE ${SANDBOX_ROLE} WITH LOGIN PASSWORD '${SANDBOX_PASSWORD}'`
    )
    await db.raw(`ALTER ROLE ${SANDBOX_ROLE} RESET ALL`)
    await db.raw(`GRANT USAGE ON SCHEMA public TO ${SANDBOX_ROLE}`)
    await db.raw(`GRANT SELECT ON public.player TO ${SANDBOX_ROLE}`)

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

    await db('player').del()
    await db('player').insert([
      {
        pid: 'AARO-RODG-1983120',
        first_name: 'Aaron',
        last_name: 'Rodgers',
        short_name: 'A.Rodgers',
        formatted_name: 'aaron rodgers',
        primary_position: 'QB',
        secondary_position: 'QB'
      },
      {
        pid: 'JOSH-ALLE-1996052',
        first_name: 'Josh',
        last_name: 'Allen',
        short_name: 'J.Allen',
        formatted_name: 'josh allen',
        primary_position: 'QB',
        secondary_position: 'QB'
      }
    ])
  })

  after(async function () {
    await destroy_sandbox_db('data_view')
  })

  beforeEach(async function () {
    await db('user_data_views').del()
    await db('data_view_queries').del()
  })

  const sql_text =
    'SELECT player.pid AS "pid", player.first_name AS "first_name" FROM player ORDER BY player.pid'

  const annotations = {
    pid: { column_title: 'Player Id', fixed: 'left' },
    first_name: { column_title: 'First Name', header_label: 'First' }
  }

  it('creates a query-backed view from a hand-written statement and renders it', async function () {
    const created = await create_data_view_query({
      sql_text,
      column_annotations: annotations,
      view_name: 'hand written'
    })

    expect(created.query_id).to.be.a('string')
    expect(created.view_id).to.be.a('string')

    // Types were DERIVED. Nothing in the annotations said anything about one.
    expect(created.columns.map((column) => column.data_type)).to.eql([
      TABLE_DATA_TYPES.TEXT,
      TABLE_DATA_TYPES.TEXT
    ])

    const persisted_view = await db('user_data_views')
      .where({ view_id: created.view_id })
      .first()
    expect(persisted_view.query_id).to.equal(created.query_id)

    // The persisted table_state carries NO SQL, asserted on the object -- the
    // validator sets no $$strict and would have accepted one.
    const persisted_table_state =
      typeof persisted_view.table_state === 'string'
        ? JSON.parse(persisted_view.table_state)
        : persisted_view.table_state
    expect(JSON.stringify(persisted_table_state)).to.not.include('SELECT')
    expect(persisted_table_state.prefix_columns).to.eql(['pid'])

    // Now the render path, as the socket takes it.
    const rendered = await run_query_backed_view({
      query_id: created.query_id,
      ...persisted_table_state
    })

    expect(rendered.data_view_results).to.have.length(2)
    // Re-keyed for the table's row lookup, which reads
    // row.original[`${accessorKey}_${column_index}`].
    expect(Object.keys(rendered.data_view_results[0]).sort()).to.eql([
      'first_name_0',
      'pid_0'
    ])
    expect(
      rendered.data_view_metadata.columns.map((c) => c.column_title)
    ).to.eql(['Player Id', 'First Name'])
    expect(rendered.data_view_metadata.columns[0].is_query_backed).to.equal(
      true
    )
  })

  it('routes through the shared executor on query_id alone, with no explicit run_query', async function () {
    // The branch that covers the export route -- the one path that loads a
    // persisted table_state server-side and would otherwise index the registry
    // resolver with an ad-hoc column_id and raise a 500.
    const created = await create_data_view_query({
      sql_text,
      column_annotations: annotations,
      view_name: 'through the executor'
    })

    const { data_view_results, data_view_metadata } =
      await execute_data_view_request({
        request_id: null,
        params: { query_id: created.query_id, columns: ['pid'] },
        user_id: null,
        path: 'test',
        cache_key: `/data-views/test-${created.query_id}`,
        skip_cache: true
      })

    expect(data_view_results).to.have.length(2)
    expect(data_view_metadata.columns).to.have.length(2)
  })

  it('applies the caller sort through the outer wrap rather than the seed', async function () {
    const created = await create_data_view_query({
      sql_text,
      column_annotations: annotations,
      view_name: 'sorted'
    })

    const ascending = await run_query_backed_view({
      query_id: created.query_id,
      sort: [{ column_id: 'pid', desc: false }]
    })
    const descending = await run_query_backed_view({
      query_id: created.query_id,
      sort: [{ column_id: 'pid', desc: true }]
    })

    expect(ascending.data_view_results.map((row) => row.pid_0)).to.eql(
      descending.data_view_results.map((row) => row.pid_0).reverse()
    )
    // The seed carries an empty sort, so a run that ignored the caller's sort
    // would return the same order twice and this pair would collapse.
    expect(ascending.data_view_results[0].pid_0).to.not.equal(
      descending.data_view_results[0].pid_0
    )
  })

  it('filters through the outer wrap on a projected alias', async function () {
    const created = await create_data_view_query({
      sql_text,
      column_annotations: annotations,
      view_name: 'filtered'
    })

    const filtered = await run_query_backed_view({
      query_id: created.query_id,
      where: [{ column_id: 'first_name', operator: '=', value: 'Josh' }]
    })
    expect(filtered.data_view_results).to.have.length(1)
    expect(filtered.data_view_results[0].first_name_0).to.equal('Josh')
  })

  it('refuses a statement whose annotations do not reconcile, and persists nothing', async function () {
    let rejection = null
    try {
      await create_data_view_query({
        sql_text,
        column_annotations: { pid: { column_title: 'Player Id' } },
        view_name: 'unreconciled'
      })
    } catch (error) {
      rejection = error
    }

    expect(rejection).to.not.equal(null)
    expect(rejection.code).to.equal('unannotated_projected_alias')

    // The insert is the last thing that happens, so a refusal leaves no row.
    expect(await db('data_view_queries').pluck('query_id')).to.eql([])
    expect(await db('user_data_views').pluck('view_id')).to.eql([])
  })

  it('refuses a statement the guard rejects before it ever runs', async function () {
    let rejection = null
    try {
      await create_data_view_query({
        sql_text: 'DELETE FROM player',
        column_annotations: {},
        view_name: 'destructive'
      })
    } catch (error) {
      rejection = error
    }

    expect(rejection).to.not.equal(null)
    expect(await db('data_view_queries').pluck('query_id')).to.eql([])
  })

  it('refuses a statement reaching a relation the role cannot read', async function () {
    // The allowlist and the GRANTs are the same list, derived from one
    // classification, so this is refused at parse time rather than by Postgres.
    // rosters_players is the viewer-scoped one specifically: it backs the
    // private restricted-free-agency tags, and arbitrary SQL over it is what
    // would defeat the viewer-sharded cache key.
    let rejection = null
    try {
      await create_data_view_query({
        sql_text: 'SELECT rosters_players.pid AS "pid" FROM rosters_players',
        column_annotations: { pid: { column_title: 'Player Id' } },
        view_name: 'viewer scoped'
      })
    } catch (error) {
      rejection = error
    }

    expect(rejection).to.not.equal(null)
    expect(await db('data_view_queries').pluck('query_id')).to.eql([])
  })
})
