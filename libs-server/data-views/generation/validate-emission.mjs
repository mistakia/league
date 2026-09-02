import { resolve_generated_table_state } from './resolve-generated-table-state.mjs'

// The agent's emit contract: ONE tool, TWO branches, ONE envelope.
//
// NOT TWO TOOLS. Two tools make "registry or SQL" a selection the agent takes
// BEFORE it has evidence, which is exactly the fixed cascade the operator
// retired. One tool that accepts either branch lets the choice be the outcome of
// having tried, rather than a fork taken up front.
//
// THREE RUNGS: registry, then SQL, then refuse. That reframes what a refusal
// claims. Under the retired single-shot design "cannot express" was terminal, so
// a refusal meant only that the catalog LOOKED insufficient -- and it fired on
// 21% of views a human had demonstrably built with this same registry. Here a
// refusal claims that neither the registry NOR arbitrary SQL over the allowlist
// can answer the question, which is a far stronger claim and should be far
// rarer.
//
// WHAT THE PRECONDITION BELOW IS AND IS NOT. Requiring a prior registry attempt
// before the query branch is a SPEED BUMP, not a control: an agent can satisfy
// it with one throwaway validate_table_state call. It is kept because it costs
// nothing and makes the ordering legible. The real control is measurement -- all
// 189 corpus views are registry-expressible by construction, so a query-backed
// answer to a corpus view is an unnecessary SQL reach, reportable as a rate
// beside accuracy with no new infrastructure. A preference nothing measures is a
// preference that decays.

export const EMISSION_ERROR_CODES = {
  malformed_emission: 'malformed_emission',
  missing_envelope_field: 'missing_envelope_field',
  both_branches: 'both_branches',
  no_branch: 'no_branch',
  refusal_without_reason: 'refusal_without_reason',
  reason_on_an_answer: 'reason_on_an_answer',
  table_state_invalid: 'table_state_invalid',
  query_branch_without_registry_attempt:
    'query_branch_without_registry_attempt',
  declared_data_type: 'declared_data_type',
  missing_column_annotations: 'missing_column_annotations'
}

const error = (code, message, path) => ({ code, message, path })

// Walk the whole annotation block rather than checking its top level. A
// data_type buried one level down is the same contract violation and the same
// class of failure -- a declared type disagreeing with the column's real one --
// and a shallow check that passes it reads as compliance.
const find_declared_data_type = (value, path = 'column_annotations') => {
  if (!value || typeof value !== 'object') return null
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = find_declared_data_type(item, `${path}[${index}]`)
      if (found) return found
    }
    return null
  }
  for (const [key, item] of Object.entries(value)) {
    if (key === 'data_type') return `${path}.data_type`
    const found = find_declared_data_type(item, `${path}.${key}`)
    if (found) return found
  }
  return null
}

/**
 * Validate one emission from the agent.
 *
 * @param {object} opts
 * @param {object} opts.emission - what the agent emitted
 * @param {Array<string>} [opts.tool_calls] - the tool names called this run, in
 *   order. The registry-first precondition reads this and nothing else.
 * @param {object} [opts.catalog]
 * @returns {{ ok: boolean, branch: string|null, errors: Array<object> }}
 */
export const validate_emission = ({ emission, tool_calls = [], catalog }) => {
  const errors = []

  if (!emission || typeof emission !== 'object' || Array.isArray(emission)) {
    return {
      ok: false,
      branch: null,
      errors: [
        error(
          EMISSION_ERROR_CODES.malformed_emission,
          'emission must be an object',
          'emission'
        )
      ]
    }
  }

  // The envelope is the same either way, and every field is REQUIRED rather
  // than optional. Left optional in the retired design, the model filled
  // neither: live runs produced `expressible: false` with no reason at all, and
  // the reason is the only thing that says WHY. An empty string is the answer
  // for the field that does not apply.
  for (const field of ['expressible', 'explanation', 'inexpressible_reason']) {
    if (emission[field] === undefined) {
      errors.push(
        error(
          EMISSION_ERROR_CODES.missing_envelope_field,
          `${field} is required on every emission, including a refusal`,
          field
        )
      )
    }
  }

  const has_registry_branch = emission.table_state !== undefined
  const has_query_branch = emission.sql_text !== undefined

  if (emission.expressible === false) {
    if (has_registry_branch || has_query_branch) {
      errors.push(
        error(
          EMISSION_ERROR_CODES.reason_on_an_answer,
          'a refusal carries neither table_state nor sql_text',
          'expressible'
        )
      )
    }
    if (!emission.inexpressible_reason) {
      errors.push(
        error(
          EMISSION_ERROR_CODES.refusal_without_reason,
          'a refusal must say what neither the registry nor SQL could express',
          'inexpressible_reason'
        )
      )
    }
    return { ok: errors.length === 0, branch: 'refusal', errors }
  }

  if (has_registry_branch && has_query_branch) {
    errors.push(
      error(
        EMISSION_ERROR_CODES.both_branches,
        'emit exactly one of table_state or sql_text, never both',
        'emission'
      )
    )
    return { ok: false, branch: null, errors }
  }

  if (!has_registry_branch && !has_query_branch) {
    errors.push(
      error(
        EMISSION_ERROR_CODES.no_branch,
        'an expressible emission carries either table_state or sql_text',
        'emission'
      )
    )
    return { ok: false, branch: null, errors }
  }

  if (has_registry_branch) {
    const resolved = resolve_generated_table_state({
      table_state: emission.table_state,
      ...(catalog ? { catalog } : {})
    })
    if (!resolved.ok) {
      for (const resolver_error of resolved.errors) {
        errors.push(
          error(
            EMISSION_ERROR_CODES.table_state_invalid,
            resolver_error.message,
            resolver_error.path
          )
        )
      }
    }
    return { ok: errors.length === 0, branch: 'registry', errors }
  }

  // The query branch.
  if (!tool_calls.includes('validate_table_state')) {
    errors.push(
      error(
        EMISSION_ERROR_CODES.query_branch_without_registry_attempt,
        'reach for SQL only after attempting the registry: call validate_table_state and state what fell short',
        'sql_text'
      )
    )
  }

  if (
    !emission.column_annotations ||
    typeof emission.column_annotations !== 'object'
  ) {
    errors.push(
      error(
        EMISSION_ERROR_CODES.missing_column_annotations,
        'the query branch carries column_annotations, one entry per projected alias',
        'column_annotations'
      )
    )
  } else {
    // A DECLARED data_type is a contract violation, not a hint. Types are read
    // off the pg field descriptors, so declaring one re-opens the entire class
    // of failure where the declaration disagrees with the column's real type
    // and a number renders as text. The deriver admits exactly one exception --
    // an OID it cannot bucket -- and that is its call to make against a live
    // result, not the agent's to assert in advance.
    const declared = find_declared_data_type(emission.column_annotations)
    if (declared) {
      errors.push(
        error(
          EMISSION_ERROR_CODES.declared_data_type,
          'data_type is derived from the query and must not be declared',
          declared
        )
      )
    }
  }

  return { ok: errors.length === 0, branch: 'query', errors }
}

export default validate_emission
