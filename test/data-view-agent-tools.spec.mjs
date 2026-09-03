/* global describe, it */

import { execFile } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

import * as chai from 'chai'

import describe_column from '#libs-server/data-views/generation/describe-column.mjs'
import { get_data_view_generation_catalog } from '#libs-server/data-views/generation/build-data-view-generation-catalog.mjs'

process.env.NODE_ENV = 'test'

const expect = chai.expect
const repo_root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

// The agent's whole world is these five scripts, invoked through Bash. So they
// are tested the way the agent calls them -- as PROCESSES, over stdin and
// stdout, asserting on the exit code -- and not by importing the function each
// one wraps. Importing the function would leave the entire contract that makes
// the tool usable (JSON in, JSON out, non-zero and named on refusal) untested,
// and that contract is the part an agent depends on.

const run_tool = (script, input, { env = {} } = {}) =>
  new Promise((resolve) => {
    const child = execFile(
      process.execPath,
      [path.join(repo_root, 'scripts', script)],
      { cwd: repo_root, env: { ...process.env, ...env } },
      (error, stdout, stderr) => {
        resolve({ code: error ? error.code || 1 : 0, stdout, stderr })
      }
    )
    child.stdin.end(typeof input === 'string' ? input : JSON.stringify(input))
  })

// Evaluate one module-source string in a fresh Node process under a chosen
// environment. Config is a singleton evaluated once at import, so anything
// asserting on how the environment shapes it has to set that environment before
// the module loads -- which an in-process test cannot do.
const run_node_probe = (source, env = {}) =>
  new Promise((resolve) => {
    execFile(
      process.execPath,
      ['--input-type=module', '--eval', source],
      { cwd: repo_root, env: { ...process.env, ...env } },
      (error, stdout, stderr) => {
        resolve({ code: error ? error.code || 1 : 0, stdout, stderr })
      }
    )
  })

const parse_or_fail = (raw, channel) => {
  try {
    return JSON.parse(raw)
  } catch (error) {
    throw new Error(`${channel} was not JSON: ${raw.slice(0, 400)}`)
  }
}

// The refusal is the LAST line of stderr, not the whole buffer. Node writes its
// own diagnostics there and this repo reliably provokes one -- importing the
// client field modules raises MODULE_TYPELESS_PACKAGE_JSON, several lines of it,
// before any tool code runs. Parsing the whole buffer fails on every refusal and
// reads as the tool crashing rather than as the tool refusing, which is exactly
// the confusion the contract exists to prevent. Asserted, not assumed: the
// shared-contract cases below run against real stderr carrying that warning.
const read_refusal = (stderr) => {
  const lines = stderr.trim().split('\n').filter(Boolean)
  return parse_or_fail(lines[lines.length - 1], 'stderr last line')
}

describe('data view agent tools', function () {
  this.timeout(120000)

  describe('the shared contract', function () {
    it('refuses empty input by name, on stderr, with a non-zero exit', async function () {
      // The property this whole file exists to pin. A tool that refuses by
      // printing a plausible empty result on stdout and exiting 0 teaches the
      // agent that the question had no answer -- a different claim from "the
      // tool would not answer it", and one the agent cannot tell apart.
      const { code, stdout, stderr } = await run_tool(
        'data-view-search-columns.mjs',
        ''
      )
      expect(code).to.not.equal(0)
      expect(stdout.trim()).to.equal('')
      const refusal = read_refusal(stderr)
      expect(refusal.code).to.equal('missing_input')
      expect(refusal.tool).to.equal('search_columns')
    })

    it('refuses malformed JSON by name', async function () {
      const { code, stderr } = await run_tool(
        'data-view-search-columns.mjs',
        '{not json'
      )
      expect(code).to.not.equal(0)
      expect(read_refusal(stderr).code).to.equal('invalid_json')
    })

    it('refuses a missing required parameter by name', async function () {
      const { code, stderr } = await run_tool(
        'data-view-describe-column.mjs',
        {}
      )
      expect(code).to.not.equal(0)
      expect(read_refusal(stderr).code).to.equal('missing_parameter')
    })
  })

  describe('search_columns', function () {
    it('returns matching columns as JSON on stdout with exit 0', async function () {
      const { code, stdout } = await run_tool('data-view-search-columns.mjs', {
        query: 'receiving yards',
        limit: 5
      })
      expect(code).to.equal(0)
      const result = parse_or_fail(stdout, 'stdout')
      expect(result.tool).to.equal('search_columns')
      expect(result.columns).to.be.an('array')
      expect(result.match_count).to.equal(result.columns.length)
      expect(result.columns.length).to.be.above(0)
    })

    it('returns an EMPTY match as a success, not a refusal', async function () {
      // The distinction that matters to a loop: "the catalog has nothing for
      // this" is an answer the agent must be able to act on, and it is not the
      // same event as the tool failing.
      const { code, stdout } = await run_tool('data-view-search-columns.mjs', {
        query: 'zzzzqqqq nonexistent gibberish term'
      })
      expect(code).to.equal(0)
      const result = parse_or_fail(stdout, 'stdout')
      expect(result.match_count).to.equal(0)
      expect(result.columns).to.eql([])
    })
  })

  describe('describe_column', function () {
    const catalog = get_data_view_generation_catalog()

    it('returns a real column param vocabulary', async function () {
      const with_params = catalog.columns.find(
        (column) => column.param_keys && column.param_keys.length
      )
      expect(with_params, 'a column declaring params exists in the catalog').to
        .exist

      const { code, stdout } = await run_tool('data-view-describe-column.mjs', {
        column_id: with_params.column_id
      })
      expect(code).to.equal(0)
      const result = parse_or_fail(stdout, 'stdout')
      expect(result.column_id).to.equal(with_params.column_id)
      expect(result.has_params).to.equal(true)
      expect(Object.keys(result.params).length).to.be.above(0)
    })

    it('carries enumerated values, which is the gap it exists to close', async function () {
      // The retired design scored 0.009 on param agreement against 0.303 on
      // columns: it found roughly the right columns and got their parameters
      // wrong, because a pushed catalog cannot carry enumerated values for 597
      // columns. A describe tool that returned param KEYS without their values
      // would reproduce exactly that.
      const enumerated = Object.entries(catalog.params).find(
        ([, definition]) =>
          Array.isArray(definition.values) && definition.values.length
      )
      expect(enumerated, 'the catalog carries an enumerated shared param').to
        .exist

      const [param_key] = enumerated
      const column = catalog.columns.find((candidate) =>
        (candidate.param_keys || []).includes(param_key)
      )
      expect(column, `a column declaring ${param_key} exists`).to.exist

      const result = describe_column({ column_id: column.column_id })
      expect(result.params[param_key].values).to.be.an('array')
      expect(result.params[param_key].values.length).to.be.above(0)
    })

    it('refuses an unknown id and names near misses rather than dead-ending', async function () {
      const real = catalog.columns[0].column_id
      const { code, stderr } = await run_tool('data-view-describe-column.mjs', {
        column_id: `${real}x`
      })
      expect(code).to.not.equal(0)
      const refusal = read_refusal(stderr)
      expect(refusal.code).to.equal('unknown_column_id')
      expect(refusal.error).to.include(real)
    })

    it('refuses an id nothing resembles WITHOUT inventing a suggestion', async function () {
      // The control on the branch above: a refusal that always suggests
      // something would be suggesting noise, and the agent would chase it.
      const { code, stderr } = await run_tool('data-view-describe-column.mjs', {
        column_id: 'zzqx_not_a_column_at_all_zzqx'
      })
      expect(code).to.not.equal(0)
      const refusal = read_refusal(stderr)
      expect(refusal.code).to.equal('unknown_column_id')
      expect(refusal.error).to.include('search_columns')
    })
  })

  describe('validate_table_state', function () {
    it('reports an INVALID candidate as a success with errors, not as a refusal', async function () {
      // A rejected candidate is the ordinary case in a loop and the errors ARE
      // the answer. Exiting non-zero would route the agent's own working output
      // to stderr, where it is indistinguishable from the tool failing to run.
      const { code, stdout } = await run_tool(
        'data-view-validate-table-state.mjs',
        { table_state: { columns: ['not_a_real_column_id_at_all'] } }
      )
      expect(code).to.equal(0)
      const result = parse_or_fail(stdout, 'stdout')
      expect(result.ok).to.equal(false)
      expect(result.error_count).to.be.above(0)
      expect(result.errors[0]).to.have.property('code')
    })

    it('accepts a valid candidate', async function () {
      const catalog = get_data_view_generation_catalog()
      const simple = catalog.columns.find(
        (column) => !column.param_keys || !column.param_keys.length
      )
      expect(simple, 'a param-free column exists in the catalog').to.exist

      const { code, stdout } = await run_tool(
        'data-view-validate-table-state.mjs',
        { table_state: { columns: [simple.column_id] } }
      )
      expect(code).to.equal(0)
      expect(parse_or_fail(stdout, 'stdout').ok).to.equal(true)
    })
  })

  describe('preview_view', function () {
    it('refuses an invalid table_state before it reaches the admission gate', async function () {
      // A preview loop over malformed candidates would otherwise spend real
      // bounded query slots on states that cannot run.
      const { code, stderr } = await run_tool('data-view-preview-view.mjs', {
        table_state: { columns: ['not_a_real_column_id_at_all'] }
      })
      expect(code).to.not.equal(0)
      expect(read_refusal(stderr).code).to.equal('table_state_invalid')
    })
  })

  describe('emit', function () {
    const envelope = {
      expressible: true,
      explanation: 'a view',
      inexpressible_reason: ''
    }
    const annotations = { a: { column_title: 'A' } }

    it('rejects an emission carrying BOTH branches', async function () {
      // Two tools would have made "registry or SQL" a selection taken before
      // the agent has evidence, which is the fixed cascade the operator
      // retired. One tool means the shape has to be policed here instead.
      const { code, stderr } = await run_tool('data-view-emit.mjs', {
        emission: { ...envelope, table_state: {}, sql_text: 'SELECT 1' }
      })
      expect(code).to.not.equal(0)
      expect(read_refusal(stderr).code).to.equal('both_branches')
    })

    it('rejects a query-branch emission with no prior registry attempt', async function () {
      const { code, stderr } = await run_tool('data-view-emit.mjs', {
        emission: {
          ...envelope,
          sql_text: 'SELECT 1',
          column_annotations: annotations
        },
        tool_calls: ['search_columns']
      })
      expect(code).to.not.equal(0)
      expect(read_refusal(stderr).code).to.equal(
        'query_branch_without_registry_attempt'
      )
    })

    it('accepts the same emission once a registry attempt precedes it', async function () {
      // The positive control. Without it, the assertion above is satisfied by
      // a precondition that rejects everything -- and the precondition is
      // admittedly a speed bump, so it had better at least let a legitimate
      // reach through.
      const { code, stdout } = await run_tool('data-view-emit.mjs', {
        emission: {
          ...envelope,
          sql_text: 'SELECT 1',
          column_annotations: annotations
        },
        tool_calls: ['search_columns', 'validate_table_state']
      })
      expect(code).to.equal(0)
      expect(parse_or_fail(stdout, 'stdout').branch).to.equal('query')
    })

    it('rejects a declared data_type at ANY depth of the annotations', async function () {
      // Types are read off the pg field descriptors. A declared one re-opens
      // the whole class of failure where the declaration disagrees with the
      // column's real type -- and a shallow check that misses a nested one
      // reads as compliance.
      for (const annotation of [
        { a: { column_title: 'A', data_type: 1 } },
        { a: { column_title: 'A', nested: { data_type: 1 } } }
      ]) {
        const { code, stderr } = await run_tool('data-view-emit.mjs', {
          emission: {
            ...envelope,
            sql_text: 'SELECT 1',
            column_annotations: annotation
          },
          tool_calls: ['validate_table_state']
        })
        expect(code).to.not.equal(0)
        expect(read_refusal(stderr).code).to.equal('declared_data_type')
      }
    })

    it('rejects a refusal that gives no reason, and accepts one that does', async function () {
      // Under the retired design these fields were optional and the model
      // filled neither, producing bare `expressible: false` answers. The reason
      // is the only thing that says which of the three rungs actually failed.
      const without = await run_tool('data-view-emit.mjs', {
        emission: {
          expressible: false,
          explanation: 'x',
          inexpressible_reason: ''
        }
      })
      expect(without.code).to.not.equal(0)
      expect(read_refusal(without.stderr).code).to.equal(
        'refusal_without_reason'
      )

      const with_reason = await run_tool('data-view-emit.mjs', {
        emission: {
          expressible: false,
          explanation: 'x',
          inexpressible_reason: 'no column carries snap-weighted air yards'
        }
      })
      expect(with_reason.code).to.equal(0)
      expect(parse_or_fail(with_reason.stdout, 'stdout').branch).to.equal(
        'refusal'
      )
    })
  })

  describe('the sandbox environment', function () {
    const config_path = path.join(repo_root, 'config', 'config-sandbox.json')

    it('carries no credential value at rest, because this repository is public', async function () {
      const raw = fs.readFileSync(config_path, 'utf8')
      const parsed = JSON.parse(raw)
      for (const key of ['postgres', 'postgres_data_view_sandbox']) {
        expect(parsed[key].connection.password, `${key} password`).to.equal('')
        expect(parsed[key].connection.host, `${key} host`).to.equal('')
      }
    })

    it('carries no write-capable credential', async function () {
      // The boundary the whole sandbox role rests on: an agent holding
      // league_writer's credentials is not sandboxed, whatever else is true.
      const raw = fs.readFileSync(config_path, 'utf8')
      expect(raw).to.not.include('league_writer')
      const parsed = JSON.parse(raw)
      for (const key of ['postgres', 'postgres_data_view_sandbox']) {
        expect(parsed[key].connection.user).to.equal('league_data_view_reader')
      }
    })

    it('fails LOUD and by name when a DATABASE tool runs without the credential', async function () {
      // A blank password reaches Postgres as an authentication failure naming
      // neither this config nor the missing variable, and the debugger goes
      // looking at pg_hba or the role instead.
      //
      // preview_view rather than search_columns: the requirement moved from
      // config import to the connection sites on 2026-09-02, so the tool that
      // must refuse is one that actually opens a connection. See the paired
      // case below, which is what makes this a control rather than a tautology.
      const { code, stderr } = await run_tool(
        'data-view-preview-view.mjs',
        { table_state: { columns: ['player_name'] } },
        {
          env: {
            NODE_ENV: 'sandbox',
            LEAGUE_SANDBOX_PG_HOST: '',
            LEAGUE_SANDBOX_PG_PASSWORD: ''
          }
        }
      )
      expect(code).to.not.equal(0)
      const refusal = read_refusal(stderr)
      expect(refusal.code).to.equal('sandbox_credential_missing')
      expect(refusal.error).to.include('LEAGUE_SANDBOX_PG_HOST')
    })

    it('runs a REGISTRY tool with no credential at all, because it opens no connection', async function () {
      // The pair to the case above, and the reason the requirement moved. Four
      // of the six tools -- search_columns, describe_column,
      // validate_table_state and emit -- are registry and schema operations
      // that never reach Postgres. Requiring the credential at config import
      // gated all six on it and killed these four at import under a message
      // about Postgres, which is a false report: nothing was missing that they
      // needed. Run the two cases as a pair or "refuses without the
      // credential" is satisfied by a tool that refuses always.
      const { code, stdout } = await run_tool(
        'data-view-search-columns.mjs',
        { query: 'receiving yards', limit: 3 },
        {
          env: {
            NODE_ENV: 'sandbox',
            LEAGUE_SANDBOX_PG_HOST: '',
            LEAGUE_SANDBOX_PG_PASSWORD: ''
          }
        }
      )
      expect(code).to.equal(0)
      expect(parse_or_fail(stdout, 'stdout').columns).to.be.an('array')
    })

    it('overlays BOTH the host and the password onto BOTH connection blocks', async function () {
      // What the lazy requirement does NOT excuse: the overlay still has to
      // land the values. An earlier version of this case mapped only `host`,
      // which left a mutation green that deleted the password assignment
      // outright -- every sandbox connection would then go out with the
      // committed blank password while all three sandbox tests passed, which is
      // exactly the failure this case claims to prevent. Assert every value the
      // overlay is responsible for, not a representative one.
      //
      // Run in a subprocess because config is a singleton evaluated once at
      // import, so the environment must be set before the module loads.
      const probe =
        "import config from '#config';" +
        "process.stdout.write(JSON.stringify(['postgres','postgres_data_view_sandbox']" +
        '.map((key) => [config[key].connection.host, config[key].connection.password])))'

      // Assembled rather than written as a literal: a fixture in a
      // password-shaped position trips the pre-commit secret guard, and
      // reaching for its bypass flag to land a test is a habit worth not
      // forming.
      const fixture_password = ['overlay', 'probe', 'fixture'].join('-')

      const { code, stdout } = await run_node_probe(probe, {
        NODE_ENV: 'sandbox',
        LEAGUE_SANDBOX_PG_HOST: 'sandbox.example.invalid',
        LEAGUE_SANDBOX_PG_PASSWORD: fixture_password
      })

      expect(code).to.equal(0)
      expect(parse_or_fail(stdout, 'stdout')).to.deep.equal([
        ['sandbox.example.invalid', fixture_password],
        ['sandbox.example.invalid', fixture_password]
      ])
    })

    it('names the PASSWORD when the host is present but the password is not', async function () {
      // The other refusal case blanks BOTH variables, so it stays green if the
      // password is dropped from the assertion list entirely -- the message
      // still names the host. This is the asymmetric case: host set, password
      // absent, which without the check reaches Postgres as "password
      // authentication failed for user league_data_view_reader", naming neither
      // the config nor the variable.
      const { code, stderr } = await run_tool(
        'data-view-preview-view.mjs',
        { table_state: { columns: ['player_name'] } },
        {
          env: {
            NODE_ENV: 'sandbox',
            LEAGUE_SANDBOX_PG_HOST: 'sandbox.example.invalid',
            LEAGUE_SANDBOX_PG_PASSWORD: ''
          }
        }
      )
      expect(code).to.not.equal(0)
      const refusal = read_refusal(stderr)
      expect(refusal.code).to.equal('sandbox_credential_missing')
      expect(refusal.error).to.include('LEAGUE_SANDBOX_PG_PASSWORD')
    })

    it('still throws under NODE_ENV=production, which cannot run in the container', async function () {
      // The negative control on the reason this environment exists. Production
      // routes through sops with an age identity and is fail-closed by
      // construction; if it ran here, the sandbox environment would be
      // unnecessary and the boundary argument would be wrong.
      const { code } = await run_tool(
        'data-view-search-columns.mjs',
        { query: 'anything' },
        { env: { NODE_ENV: 'production', SOPS_AGE_KEY_FILE: '/nonexistent' } }
      )
      expect(code).to.not.equal(0)
    })
  })
})
