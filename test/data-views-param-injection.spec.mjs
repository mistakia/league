/* global describe, it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'

import server from '#api'
import {
  sql_identifier_param,
  sql_integer_param,
  sql_slug_param
} from '#libs-server/data-views/sanitize-sql-param.mjs'
import { get_data_view_results_query } from '#libs-server/get-data-view-results.mjs'

process.env.NODE_ENV = 'test'
chai.use(chai_http)
chai.should()

const expect = chai.expect

// where_clause.params is NOT covered by table_state_validator -- its params
// schema declares only the `output` key and is not $$strict, so every other key
// arrives from the request as arbitrary JSON. Several column definitions splice
// those params straight into SQL text, and POST /api/data-views/search is
// unauthenticated, so this was a live injection path until the params were
// validated at each splice site.
//
// The payload below carries a quote, a space and a comment marker. A bare word
// would not do: it is itself a legal identifier and a legal quoted value, so
// finding it in generated SQL would prove nothing.
const injection_payload = "x' or 1=1--"

describe('data view params cannot reach SQL', function () {
  this.timeout(20000)

  describe('sanitize-sql-param', function () {
    it('rejects an identifier that could break out', function () {
      expect(() =>
        sql_identifier_param({
          value: injection_payload,
          param_name: 'dvoa_type'
        })
      ).to.throw(/invalid data view param: dvoa_type/)
    })

    it('accepts a wellformed identifier', function () {
      expect(
        sql_identifier_param({
          value: 'red_zone_dvoa',
          param_name: 'dvoa_type'
        })
      ).to.equal('red_zone_dvoa')
    })

    it('rejects a non-integer year and returns a number for a numeric string', function () {
      expect(() =>
        sql_integer_param({ value: injection_payload, param_name: 'year' })
      ).to.throw(/invalid data view param: year/)
      expect(sql_integer_param({ value: '2024', param_name: 'year' })).to.equal(
        2024
      )
    })

    it('rejects a malformed format id but accepts a uuid and a slug', function () {
      expect(() =>
        sql_slug_param({
          value: injection_payload,
          param_name: 'league_format_id'
        })
      ).to.throw(/invalid data view param: league_format_id/)
      // Production carries both shapes; rejecting either would break saved views.
      expect(
        sql_slug_param({
          value: '001eb136-c0e3-41a4-8589-10a0e01cf12a',
          param_name: 'league_format_id'
        })
      ).to.equal('001eb136-c0e3-41a4-8589-10a0e01cf12a')
      expect(
        sql_slug_param({
          value: 'genesis_10_team',
          param_name: 'league_format_id'
        })
      ).to.equal('genesis_10_team')
    })
  })

  describe('query builder', function () {
    // One case per splice site found in the audit. Each asserts the builder
    // refuses rather than emitting SQL, which is the only outcome that
    // distinguishes a fix from an escape that still lets the value through.
    // `params.year` is deliberately absent here. It is normalized to an array
    // by process_item_params before any column definition sees it, so a crafted
    // year never reaches SQL through this path and asserting a rejection would
    // pin behaviour that does not exist. The keys below are the ones a crafted
    // value actually reaches SQL through.
    const cases = [
      {
        column_id: 'player_league_fantasy_team',
        params: { lid: injection_payload }
      },
      {
        column_id: 'player_league_extended_salary_over_market',
        params: { league_format_id: injection_payload }
      },
      { column_id: 'team_unit_dvoa', params: { dvoa_type: injection_payload } },
      {
        column_id: 'player_game_prop_historical_hit_rate',
        params: { hit_type: injection_payload }
      },
      {
        column_id: 'player_game_prop_historical_edge',
        params: { historical_range: injection_payload }
      }
    ]

    for (const { column_id, params } of cases) {
      it(`refuses a crafted param on ${column_id}`, async function () {
        let threw = false
        try {
          await get_data_view_results_query({
            columns: ['player_name'],
            where: [{ column_id, operator: '=', value: 'abc', params }],
            limit: 5
          })
        } catch (error) {
          threw = true
          expect(error.is_invalid_param, 'marked as a bad request').to.equal(
            true
          )
        }
        expect(threw, 'query builder rejected the param').to.equal(true)
      })
    }

    it('still builds SQL for the same columns with legitimate params', async function () {
      const { query } = await get_data_view_results_query({
        columns: [
          'player_name',
          {
            column_id: 'team_unit_dvoa',
            params: { dvoa_type: 'red_zone_dvoa', year: 2024 }
          }
        ],
        limit: 5
      })
      const sql = query.toString()
      expect(sql).to.include('red_zone_dvoa')
      expect(sql).to.not.include('1=1')
    })
  })

  describe('POST /api/data-views/search', function () {
    it('answers 400, not 500, for a crafted param', async function () {
      const res = await chai_request
        .execute(server)
        .post('/api/data-views/search')
        .send({
          columns: ['player_name'],
          where: [
            {
              column_id: 'team_unit_dvoa',
              operator: '>',
              value: 0,
              params: { dvoa_type: injection_payload }
            }
          ]
        })
      res.should.have.status(400)
      res.body.error.should.match(/invalid data view param: dvoa_type/)
    })
  })
})
