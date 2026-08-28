import { loadModule, parseSync } from 'libpg-query'

import { get_sandbox_relation_allowlist } from './sandbox-relation-allowlist.mjs'

// The parse-time half of the sandbox. The role's GRANTs are the other half, and
// neither is trusted alone: this module can be wrong about a node shape, and the
// GRANTs cannot deny pg_stat_statements (PUBLIC EXECUTE) or bind a view to the
// table exclusions its owner's privileges bypass.
//
// WHERE THIS RUNS. At emit time -- when league is asked to persist a proposed
// statement -- and at execute time, when it runs a persisted one. It is
// deliberately NOT on the generation agent's exploration path: the agent holds
// the sandbox role's credential and opens its own connection, and its research
// queries are bounded by the GRANTs. This guard protects the VIEWER of a saved
// view from SQL they did not write.
//
// GRAMMAR VERSION. libpg-query 17.7.4 parses a PostgreSQL 17 grammar; the server
// is 16.15. The mismatch runs in the harmless direction -- a statement using
// 17-only syntax passes the guard and is then a syntax error at execution -- and
// never the reverse, because 16 is a subset of 17.
//
// Three AST shapes in this file FAIL OPEN if handled naively, all three measured
// during planning. They are called out at their branches, and each has a spec
// with a positive control in test/data-view-sql-sandbox.spec.mjs.

export class GeneratedSqlRejection extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'GeneratedSqlRejection'
    this.code = code
  }
}

const reject = (code, message) => {
  throw new GeneratedSqlRejection(code, message)
}

// Postgres truncates an identifier to 63 bytes with a NOTICE rather than an
// error, so two aliases that are distinct in the AST can collide in the result
// -- measured: two 67-byte aliases differing only in their suffix both truncated
// to the same name and an outer ORDER BY then failed "column reference ... is
// ambiguous". Uniqueness is therefore checked on the truncated form.
//
// Truncation is by BYTE, and Postgres does not split a multibyte character, so
// this decodes and drops a trailing partial one rather than emitting U+FFFD.
const NAMEDATALEN_BYTES = 63

export const truncate_identifier = (name) => {
  const bytes = Buffer.from(name, 'utf8')
  if (bytes.length <= NAMEDATALEN_BYTES) return name
  const decoder = new TextDecoder('utf8', { fatal: false })
  return decoder.decode(bytes.subarray(0, NAMEDATALEN_BYTES)).replace(/�$/, '')
}

// An alias may legally contain a doubled double-quote, so every builder that
// puts one back into SQL -- the outer ORDER BY, the outer WHERE -- must escape
// it. Interpolating the raw name is an injection point.
export const quote_output_identifier = (name) => `"${name.replace(/"/g, '""')}"`

// Any node key ending in `Stmt` other than SelectStmt is a write or a DDL
// statement, at any depth. Stated as a RULE rather than as an enumeration on
// purpose: an enumerated list of InsertStmt/UpdateStmt/DeleteStmt/CopyStmt is
// one Postgres release away from missing a node, and the miss fails open.
// Measured shapes this catches: InsertStmt/UpdateStmt/DeleteStmt at CTE depth 9,
// CopyStmt at depth 3, DeleteStmt at depth 27 inside a four-level nested CTE.
const is_statement_node_key = (key) => key.endsWith('Stmt')

const walk_ast = (node, visit) => {
  if (node === null || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const item of node) walk_ast(item, visit)
    return
  }
  for (const [key, value] of Object.entries(node)) {
    visit(key, value, node)
    walk_ast(value, visit)
  }
}

const assert_no_writes_or_ddl = (parse_tree) => {
  walk_ast(parse_tree, (key, value) => {
    if (is_statement_node_key(key) && key !== 'SelectStmt') {
      reject(
        'forbidden_statement',
        `${key} is not permitted; the sandbox executes SELECT only`
      )
    }
    // SELECT ... FOR UPDATE / SHARE takes row locks and is a write in every
    // sense that matters here. It surfaces as a lockingClause on the SelectStmt
    // rather than as a distinct node type, so the *Stmt rule above does not see
    // it.
    if (key === 'lockingClause' && Array.isArray(value) && value.length) {
      reject('locking_clause', 'FOR UPDATE / FOR SHARE is not permitted')
    }
    // SELECT ... INTO creates a table. It is a SelectStmt carrying an
    // intoClause, so it too slips past the *Stmt rule.
    if (key === 'intoClause' && value) {
      reject('into_clause', 'SELECT ... INTO is not permitted')
    }
  })
}

const relation_name_of = (range_var) => {
  const schema = range_var.schemaname
  if (schema && schema !== 'public') {
    reject(
      'forbidden_schema',
      `schema ${schema} is not readable by the sandbox; only public is`
    )
  }
  return range_var.relname
}

// Every name a WITH clause binds, anywhere in the tree. A CTE reference is a
// RangeVar indistinguishable from a table reference, so the allowlist check has
// to know these names or it rejects every query using a CTE.
const collect_cte_names = (parse_tree) => {
  const names = new Set()
  walk_ast(parse_tree, (key, value) => {
    if (key === 'CommonTableExpr' && value && value.ctename) {
      names.add(value.ctename)
    }
  })
  return names
}

const assert_relations_allowlisted = ({ parse_tree, allowlist }) => {
  const cte_names = collect_cte_names(parse_tree)
  walk_ast(parse_tree, (key, value) => {
    if (key === 'RangeVar' && value) {
      const relation = relation_name_of(value)
      if (cte_names.has(relation)) return
      if (!allowlist.has(relation)) {
        reject(
          'relation_not_allowlisted',
          `relation ${relation} is not in the sandbox allowlist`
        )
      }
    }
    // A function in the FROM clause reads whatever the function reads, and the
    // allowlist has nothing to say about it. pg_read_file and the COPY-adjacent
    // helpers are the shapes that matter; the GRANTs stop those too, but this is
    // the independent control.
    if (key === 'RangeFunction' && value) {
      reject(
        'range_function',
        'a set-returning function in FROM is not permitted'
      )
    }
  })
}

const target_output_name = (res_target) => {
  // The contract is an EXPLICIT alias on every output column. An implicit name
  // (`select a from t` yields `a`) is not enough: the annotation reconciliation
  // downstream matches authored descriptors to projected columns by name, and an
  // expression (`count(*)`, `a + b`, a CASE) has no implicit name at all.
  if (!res_target.name) {
    reject(
      'unaliased_output_column',
      'every output column must carry an explicit alias'
    )
  }
  return res_target.name
}

const assert_no_star = (res_target) => {
  const val = res_target.val
  if (!val) return
  if (val.ColumnRef) {
    const fields = val.ColumnRef.fields || []
    // Covers both `*` and the qualified `t.*`, which is the same A_Star node in
    // a longer field list.
    if (fields.some((field) => field.A_Star !== undefined)) {
      reject('star_projection', '* projections are not permitted')
    }
  }
}

// `select_body` is a BARE SelectStmt body, not a `{ SelectStmt: ... }` wrapper.
// That asymmetry is the third fail-open shape: larg / rarg hold bare bodies
// unlike every other node in this AST, so `node.larg.SelectStmt` is undefined
// and a check reading it passes every set operation unexamined.
const collect_output_names = (select_body) => {
  // FAIL-OPEN SHAPE 1: a set operation carries no top-level targetList. A check
  // that reads targetList and stops accepts every UNION / INTERSECT / EXCEPT
  // without looking at either arm. Recursion also covers nesting.
  if (select_body.op && select_body.op !== 'SETOP_NONE') {
    const { larg, rarg } = select_body
    if (!larg || !rarg) {
      reject('malformed_set_operation', 'set operation is missing an arm')
    }
    const left = collect_output_names(larg)
    collect_output_names(rarg)
    // Postgres takes the result column names from the LEFT arm, so those are the
    // names the wrapper and the descriptors see. Both arms are still required to
    // satisfy the contract.
    return left
  }

  // FAIL-OPEN SHAPE 2: a VALUES list carries no targetList AND no larg / rarg,
  // so it reaches the same branch as a set operation and the set-operation
  // recursion never fires. It projects real, wrappable columns (column1,
  // column2) and can appear as a set-operation arm, so it needs its own branch.
  if (select_body.valuesLists) {
    reject(
      'values_list',
      'a VALUES list projects implicit column names and cannot satisfy the alias contract'
    )
  }

  const target_list = select_body.targetList
  if (!Array.isArray(target_list) || !target_list.length) {
    reject('no_output_columns', 'statement projects no output columns')
  }

  return target_list.map((entry) => {
    const res_target = entry.ResTarget
    if (!res_target) {
      reject('unexpected_target', 'unrecognized output column node')
    }
    assert_no_star(res_target)
    return target_output_name(res_target)
  })
}

const assert_unique_after_truncation = (names) => {
  const seen = new Set()
  for (const name of names) {
    // Case-SENSITIVE: two quoted aliases differing only in case are genuinely
    // distinct in Postgres, and a case-insensitive dedupe would false-reject a
    // legal statement.
    const truncated = truncate_identifier(name)
    if (seen.has(truncated)) {
      reject(
        'duplicate_output_alias',
        `output alias ${truncated} is not unique after 63-byte truncation`
      )
    }
    seen.add(truncated)
  }
}

let wasm_loaded = false
const ensure_parser_loaded = async () => {
  if (!wasm_loaded) {
    await loadModule()
    wasm_loaded = true
  }
}

/**
 * Validate one generated SQL statement against the sandbox contract.
 *
 * @param {object} opts
 * @param {string} opts.sql_text
 * @param {Set<string>} [opts.allowlist] - seam for tests; defaults to the same
 *   list the role's GRANTs are generated from
 * @returns {Promise<{ output_aliases: string[] }>} the projected column names in
 *   projection order, which the wrapper and the descriptor reconciliation key on
 * @throws {GeneratedSqlRejection}
 */
export default async function validate_generated_sql({
  sql_text,
  allowlist = null
}) {
  if (typeof sql_text !== 'string' || !sql_text.trim()) {
    reject('empty_statement', 'no SQL text was supplied')
  }

  await ensure_parser_loaded()

  let parsed
  try {
    parsed = parseSync(sql_text)
  } catch (error) {
    reject('parse_error', `statement did not parse: ${error.message}`)
  }

  const statements = parsed.stmts || []
  // Multi-statement injection. `pg.query(sql, [])` with an empty values array
  // stays on the simple protocol and executes every statement in the string --
  // measured with a positive control that dropped the victim table. A binding
  // cannot be forced into arbitrary SQL, so the extended protocol is not
  // available as a control and this check is the one that matters.
  if (statements.length !== 1) {
    reject(
      'multi_statement',
      `expected exactly one statement, parsed ${statements.length}`
    )
  }

  const top_level = statements[0].stmt || {}
  if (!top_level.SelectStmt) {
    reject(
      'not_a_select',
      `top-level statement must be a SELECT, got ${Object.keys(top_level)[0] || 'nothing'}`
    )
  }

  assert_no_writes_or_ddl(parsed.stmts)
  assert_relations_allowlisted({
    parse_tree: parsed.stmts,
    allowlist: allowlist || get_sandbox_relation_allowlist()
  })

  const output_aliases = collect_output_names(top_level.SelectStmt)
  assert_unique_after_truncation(output_aliases)

  return { output_aliases: output_aliases.map(truncate_identifier) }
}
