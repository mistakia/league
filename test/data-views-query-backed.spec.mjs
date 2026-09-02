/* global describe, beforeEach, it */

import * as chai from 'chai'
import crypto from 'crypto'
import * as table_constants from 'react-table/src/constants.mjs'

import db from '#db'
import derive_view_from_query_result, {
  QueryViewDerivationError
} from '#libs-server/data-views/derive-view-from-query-result.mjs'
import run_query_backed_view from '#libs-server/data-views/run-query-backed-view.mjs'
import sweep_unreferenced_data_view_queries from '#libs-server/data-views/sweep-unreferenced-data-view-queries.mjs'
import get_data_view_hash from '#libs-server/data-views/get-data-view-hash.mjs'
import resolve_pg_field_types, {
  reset_pg_field_type_memo,
  UnbucketablePgTypeError
} from '#libs-server/data-views/resolve-pg-field-types.mjs'
import get_data_view_notices from '#app/core/data-views/data-view-notices.mjs'
import build_data_view_request_params from '#app/core/data-views/build-data-view-request-params.mjs'
import { parse_url_params_to_table_state } from 'react-table/src/utils/parse-url-params-to-table-state.mjs'

process.env.NODE_ENV = 'test'

const expect = chai.expect
const { TABLE_DATA_TYPES } = table_constants

// Field descriptors as resolve_pg_field_types returns them, which is what the
// deriver actually consumes.
const text_field = {
  name: 'player_name',
  data_type: TABLE_DATA_TYPES.TEXT,
  data_type_oid: 25,
  pg_type_name: 'text'
}
const number_field = {
  name: 'points',
  data_type: TABLE_DATA_TYPES.NUMBER,
  data_type_oid: 1700,
  pg_type_name: 'numeric'
}
const boolean_field = {
  name: 'is_starter',
  data_type: TABLE_DATA_TYPES.BOOLEAN,
  data_type_oid: 16,
  pg_type_name: 'boolean'
}

const derive = (fields, column_annotations) =>
  derive_view_from_query_result({
    data_view_fields: fields,
    column_annotations
  })

const expect_rejection = (fn, code) => {
  try {
    fn()
  } catch (error) {
    expect(error).to.be.instanceOf(QueryViewDerivationError)
    expect(error.code).to.equal(code)
    return error
  }
  throw new Error(`expected a rejection with code ${code}, got none`)
}

describe('data views -- query backed', function () {
  describe('the deriver', function () {
    it('derives data_type with nothing declared about types anywhere', function () {
      const { columns } = derive([text_field, number_field, boolean_field], {
        player_name: { column_title: 'Player' },
        points: { column_title: 'Points' },
        is_starter: { column_title: 'Starter' }
      })

      expect(columns.map((column) => column.data_type)).to.eql([
        TABLE_DATA_TYPES.TEXT,
        TABLE_DATA_TYPES.NUMBER,
        TABLE_DATA_TYPES.BOOLEAN
      ])
      // Projection order, off the descriptors, not off the annotation object's
      // key order -- which JSON round trips do not preserve in general.
      expect(columns.map((column) => column.column_id)).to.eql([
        'player_name',
        'points',
        'is_starter'
      ])
    })

    it('rejects an annotation naming an alias the statement does not project', function () {
      expect_rejection(
        () =>
          derive([text_field], {
            player_name: { column_title: 'Player' },
            ghost: { column_title: 'Ghost' }
          }),
        'annotation_for_unprojected_alias'
      )
    })

    it('rejects a projected alias carrying no annotation', function () {
      expect_rejection(
        () =>
          derive([text_field, number_field], {
            player_name: { column_title: 'Player' }
          }),
        'unannotated_projected_alias'
      )
    })

    it('rejects a declared data_type when the query already supplies one', function () {
      // The whole class of "declared type disagrees with the real type" is
      // deleted by making the declaration itself the error, rather than by
      // checking that it agrees.
      expect_rejection(
        () =>
          derive([text_field], {
            player_name: {
              column_title: 'Player',
              data_type: TABLE_DATA_TYPES.NUMBER
            }
          }),
        'annotation_declares_derivable_data_type'
      )
    })

    it('requires an annotated data_type exactly when the pg type is unbucketable', function () {
      const unbucketable = {
        name: 'weird',
        data_type: null,
        data_type_oid: 999999,
        pg_type_name: 'some_exotic_type',
        unbucketable: true
      }

      expect_rejection(
        () => derive([unbucketable], { weird: { column_title: 'Weird' } }),
        'unbucketable_data_type_without_annotation'
      )

      const { columns } = derive([unbucketable], {
        weird: { column_title: 'Weird', data_type: TABLE_DATA_TYPES.TEXT }
      })
      expect(columns[0].data_type).to.equal(TABLE_DATA_TYPES.TEXT)
    })

    it('rejects an annotation key it does not recognize', function () {
      // An ignored key is how an author spends an afternoon wondering why their
      // setting did nothing.
      expect_rejection(
        () =>
          derive([text_field], {
            player_name: { column_title: 'Player', sortable: false }
          }),
        'unknown_annotation_key'
      )
    })

    it('rejects a duplicate projected alias', function () {
      expect_rejection(
        () =>
          derive([text_field, { ...text_field }], {
            player_name: { column_title: 'Player' }
          }),
        'duplicate_projected_alias'
      )
    })

    it('seeds an EMPTY sort, where, offset and limit', function () {
      const { table_state_seed } = derive([text_field, number_field], {
        player_name: { column_title: 'Player', fixed: 'left' },
        points: { column_title: 'Points' }
      })

      expect(table_state_seed.sort).to.eql([])
      expect(table_state_seed.where).to.eql([])
      expect(table_state_seed.prefix_columns).to.eql(['player_name'])
      expect(table_state_seed.columns).to.eql(['points'])
      // The seed is a display contract and carries no SQL, on the OBJECT --
      // table_state_schema sets no $$strict and would accept anything, so the
      // schema cannot be what this asserts against.
      expect(Object.keys(table_state_seed).sort()).to.eql([
        'columns',
        'prefix_columns',
        'row_axes',
        'row_grain',
        'sort',
        'where'
      ])
    })
  })

  describe('the pg type resolver', function () {
    beforeEach(function () {
      reset_pg_field_type_memo()
    })

    it('issues ONE pg_type round trip for a repeated oid', async function () {
      let round_trips = 0
      const query_runner = {
        raw: async (_sql, [oids]) => {
          round_trips += 1
          return {
            rows: oids.map((oid) => ({
              oid,
              type_name: 'text',
              typcategory: 'S'
            }))
          }
        }
      }

      const fields = [
        { name: 'a', dataTypeID: 25 },
        { name: 'b', dataTypeID: 25 },
        { name: 'c', dataTypeID: 25 }
      ]
      const resolved = await resolve_pg_field_types({ fields, query_runner })
      expect(round_trips).to.equal(1)
      expect(resolved).to.have.length(3)

      await resolve_pg_field_types({ fields, query_runner })
      expect(round_trips).to.equal(1)
    })

    it('throws by default on an unbucketable oid and marks it under allow_unresolved', async function () {
      const query_runner = {
        raw: async (_sql, [oids]) => ({
          rows: oids.map((oid) => ({
            oid,
            // A name the table has never seen, in a category it cannot bucket.
            type_name: 'some_exotic_type',
            typcategory: 'X'
          }))
        })
      }
      const fields = [{ name: 'weird', dataTypeID: 999999 }]

      let threw = null
      try {
        await resolve_pg_field_types({ fields, query_runner })
      } catch (error) {
        threw = error
      }
      expect(threw).to.be.instanceOf(UnbucketablePgTypeError)

      const resolved = await resolve_pg_field_types({
        fields,
        query_runner,
        allow_unresolved: true
      })
      expect(resolved[0].data_type).to.equal(null)
      expect(resolved[0].unbucketable).to.equal(true)
    })
  })

  describe('the cache key', function () {
    const table_state = {
      columns: ['player_name', 'points'],
      where: [],
      sort: [],
      offset: 0,
      limit: 500,
      user_id: null
    }

    it('separates two statements projecting the same aliases at the same offset and limit', function () {
      // Without query_id these two are byte-identical inputs, so they hashed
      // alike and served each other's rows -- a cross-view leak, not a hit-rate
      // question.
      const first = get_data_view_hash({ ...table_state, query_id: 'query-a' })
      const second = get_data_view_hash({ ...table_state, query_id: 'query-b' })
      expect(first).to.not.equal(second)
    })

    it('is stable for the same statement at the same offset and limit', function () {
      expect(
        get_data_view_hash({ ...table_state, query_id: 'query-a' })
      ).to.equal(get_data_view_hash({ ...table_state, query_id: 'query-a' }))
    })

    it('leaves every registry key unchanged', function () {
      // The negative control for the change itself: a request with no query_id
      // must hash exactly as it did before the key existed, or this shipped a
      // silent full cache flush.
      expect(get_data_view_hash(table_state)).to.equal(
        get_data_view_hash({ ...table_state, query_id: null })
      )
    })
  })

  describe('the seed-versus-live rule', function () {
    it('passes the CALLER sort down and never a re-derived seed', async function () {
      // The subtlest defect in this design reads as flakiness rather than as a
      // bug: a saved view whose sort is reset every time it opens. What
      // prevents it is that derivation supplies descriptors only.
      let executed_with = null
      const query_runner = () => ({
        where: () => ({
          first: async () => ({
            query_id: 'query-a',
            sql_text: 'SELECT 1',
            column_annotations: {
              player_name: { column_title: 'Player' },
              points: { column_title: 'Points' }
            }
          })
        })
      })

      const saved_sort = [{ column_id: 'points', desc: true }]
      const saved_where = [{ column_id: 'points', operator: '>', value: 10 }]

      const result = await run_query_backed_view({
        query_id: 'query-a',
        sort: saved_sort,
        where: saved_where,
        offset: 40,
        limit: 25,
        query_runner,
        execute_sql: async (opts) => {
          executed_with = opts
          return {
            data_view_results: [{ player_name: 'A', points: 12 }],
            data_view_metadata: { total_count: 1 },
            data_view_fields: [text_field, number_field]
          }
        }
      })

      expect(executed_with.sort).to.eql(saved_sort)
      expect(executed_with.where).to.eql(saved_where)
      expect(executed_with.offset).to.equal(40)
      expect(executed_with.limit).to.equal(25)

      // The descriptors ride the metadata channel the client merges wholesale.
      expect(result.data_view_metadata.columns).to.have.length(2)
      expect(result.data_view_metadata.query_id).to.equal('query-a')

      // And the rows arrive under the key the table reads: an ad-hoc alias is
      // unique, so its column index is always 0.
      expect(Object.keys(result.data_view_results[0]).sort()).to.eql([
        'player_name_0',
        'points_0'
      ])
      expect(result.data_view_results[0].points_0).to.equal(12)
    })
  })

  describe('the share link', function () {
    it('carries query_id across the round trip', function () {
      const params = new URLSearchParams()
      params.append('columns', JSON.stringify(['player_name']))
      params.append('view_id', 'view-1')
      params.append('query_id', 'query-a')

      const { table_state, view_fields } =
        parse_url_params_to_table_state(params)

      expect(view_fields.query_id).to.equal('query-a')
      // And it is NOT a table_state key -- SQL and its reference stay out of
      // the display contract.
      expect(table_state.query_id).to.equal(undefined)
    })

    it('is dropped by a parser that does not declare it, which is what the key prevents', function () {
      // The negative control. A URL missing query_id resolves to a table_state
      // whose columns are ad-hoc ids with nothing behind them -- an empty table
      // and no error, the silent-degradation shape.
      const params = new URLSearchParams()
      params.append('columns', JSON.stringify(['player_name']))
      const { view_fields } = parse_url_params_to_table_state(params)
      expect(view_fields.query_id).to.equal('')
    })
  })

  describe('the request params', function () {
    it('carries query_id beside view_id, outside the table_state spread', function () {
      const params = build_data_view_request_params({
        view_id: 'view-1',
        table_state: { columns: ['a'], sort: [] },
        query_id: 'query-a'
      })
      expect(params.query_id).to.equal('query-a')

      const registry_params = build_data_view_request_params({
        view_id: 'view-1',
        table_state: { columns: ['a'], sort: [] }
      })
      expect(registry_params).to.not.have.property('query_id')
    })
  })

  describe('the notices', function () {
    it('fires on a query-backed view and not on a registry one', function () {
      const with_query = get_data_view_notices({
        where: [],
        columns: ['points'],
        query_id: 'query-a'
      })
      expect(with_query.map((notice) => notice.code)).to.include(
        'view_backed_by_query'
      )

      const without_query = get_data_view_notices({
        where: [],
        columns: ['points']
      })
      expect(without_query.map((notice) => notice.code)).to.not.include(
        'view_backed_by_query'
      )
    })

    it('leaves the two existing rules firing', function () {
      // The registry promotion must not have dropped a rule on the way.
      const notices = get_data_view_notices({
        where: [{ params: { year: [2024] } }],
        columns: [{ column_id: 'points', params: {} }]
      })
      expect(notices.map((notice) => notice.code)).to.include(
        'filter_param_key_absent_from_columns'
      )
    })
  })

  describe('the sweep', function () {
    this.timeout(20000)

    beforeEach(async function () {
      await db('user_data_views').del()
      await db('data_view_queries').del()
    })

    it('collects an unreferenced query and leaves a referenced one', async function () {
      const referenced_id = crypto.randomUUID()
      const unreferenced_id = crypto.randomUUID()
      const old_enough = new Date(Date.now() - 48 * 60 * 60 * 1000)

      await db('data_view_queries').insert([
        {
          query_id: referenced_id,
          sql_text: 'SELECT 1 AS a',
          column_annotations: JSON.stringify({ a: { column_title: 'A' } }),
          created_at: old_enough
        },
        {
          query_id: unreferenced_id,
          sql_text: 'SELECT 2 AS b',
          column_annotations: JSON.stringify({ b: { column_title: 'B' } }),
          created_at: old_enough
        }
      ])
      await db('user_data_views').insert({
        view_id: crypto.randomUUID(),
        view_name: 'referenced',
        table_state: JSON.stringify({ columns: ['a'] }),
        query_id: referenced_id
      })

      const { collected } = await sweep_unreferenced_data_view_queries()
      expect(collected).to.eql([unreferenced_id])

      const surviving = await db('data_view_queries').pluck('query_id')
      expect(surviving).to.eql([referenced_id])
    })

    it('never collects a row younger than the grace period', async function () {
      // Forced, not waited for. A sweep with no floor races an authoring flow
      // that writes the query before the view.
      const fresh_id = crypto.randomUUID()
      await db('data_view_queries').insert({
        query_id: fresh_id,
        sql_text: 'SELECT 3 AS c',
        column_annotations: JSON.stringify({ c: { column_title: 'C' } })
      })

      const { collected } = await sweep_unreferenced_data_view_queries()
      expect(collected).to.eql([])

      // And the same sweep with no floor DOES collect it -- otherwise this
      // assertion cannot tell a working grace period from a broken query.
      const { collected: with_no_floor } =
        await sweep_unreferenced_data_view_queries({
          min_age_hours: 0,
          dry_run: true
        })
      expect(with_no_floor).to.eql([fresh_id])
    })
  })
})
