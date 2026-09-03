// Reads an `EXPLAIN (FORMAT JSON)` plan tree and answers one question: does this
// statement carry the cardinality-collapse signature that makes nested loops the
// wrong operator for it?
//
// The signature is two independent facts about the same plan:
//
//   1. Some join node -- Nested Loop, Hash Join or Merge Join -- is estimated at
//      exactly one row. Postgres clamps a join estimate to 1 rather than to a
//      fraction, so `Plan Rows == 1` on a join is the visible residue of an
//      estimate that came out below one row.
//   2. Some Nested Loop carries a `Join Filter`, meaning an equality the SQL
//      wrote was demoted out of the index condition and is being re-checked per
//      row of the inner side.
//
// Together they are the rescan pathology: the clamp is inherited as the outer
// side of the loop, the planner believes it will scan the inner subtree once,
// and it scans it tens of thousands of times. The worst production shape
// discarded 1.8 billion rows through such filters to return 500.
//
// Why these two and not something tighter: the obvious refinement is to require
// that the clamped join sit inside the OUTER subtree of the filtered loop. It
// was measured against the 139-statement production corpus and is strictly
// worse -- it selects 105 statements against this rule's 107, dropping two whose
// rescan sites the arm does eliminate. Requiring the loop's own outer INPUT to
// be the clamped node collapses to 73. The loose conjunction is the one that
// separates the population correctly, and every one of the 107 it selects has
// every Nested-Loop-with-Join-Filter site removed under `enable_nestloop = off`.
//
// The 32 statements it does not select keep the default planner, which is the
// entire point of planning twice rather than setting the flag unconditionally:
// a blanket `enable_nestloop = off` was measured taking a small view from 851ms
// to 9,198ms, and no statement without this signature is exposed to that.

const JOIN_NODE_TYPES = new Set(['Nested Loop', 'Hash Join', 'Merge Join'])

const walk_plan_nodes = function* (node) {
  yield node
  for (const child of node.Plans || []) {
    yield* walk_plan_nodes(child)
  }
}

/**
 * @param {object} plan root `Plan` node of an `EXPLAIN (FORMAT JSON)` result
 * @returns {boolean}
 */
export const plan_carries_clamp_signature = (plan) => {
  if (!plan || typeof plan !== 'object') return false

  let has_clamped_join = false
  let has_filtered_nested_loop = false

  for (const node of walk_plan_nodes(plan)) {
    const node_type = node['Node Type']
    if (JOIN_NODE_TYPES.has(node_type) && node['Plan Rows'] === 1) {
      has_clamped_join = true
    }
    if (node_type === 'Nested Loop' && 'Join Filter' in node) {
      has_filtered_nested_loop = true
    }
    if (has_clamped_join && has_filtered_nested_loop) return true
  }

  return false
}

// `EXPLAIN (FORMAT JSON)` returns one row, one column named `QUERY PLAN`, whose
// value is a one-element array of `{ Plan, ... }`. node-pg parses the json
// column for us, so this is an unwrap rather than a parse -- but it is written
// defensively because the probe must never be able to fail a request that would
// otherwise have run.
/**
 * @param {object} explain_response a pg Result from `EXPLAIN (FORMAT JSON)`
 * @returns {object | null}
 */
export const extract_plan_from_explain_response = (explain_response) => {
  const query_plan = explain_response?.rows?.[0]?.['QUERY PLAN']
  if (!Array.isArray(query_plan)) return null
  return query_plan[0]?.Plan ?? null
}

export default plan_carries_clamp_signature
