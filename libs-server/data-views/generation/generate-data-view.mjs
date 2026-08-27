// Instruction in, resolved `table_state` out — with exactly one repair round.
//
// This is the generation core. The route wraps it with auth, limits and the
// audit row; the evaluation harness drives it directly. Both must go through
// the same prompt and the same resolver, or the harness scores something the
// product does not run.
//
// WHOLE `table_state`, NOT A PATCH LANGUAGE. The edit case sends the current
// state in and gets a complete one back. A patch language would be a second
// schema to author, validate, version and prompt for, with nothing else in the
// system reusing it, and the undo it would buy already exists in local history.
//
// ONE REPAIR ROUND, THEN STOP. Resolver errors go back to the model once. A
// second failure is a fall-through, recorded with its instruction text: the
// point of the audit is to turn "how often does the registry fall short, and on
// what" into a measured distribution for the SQL tier to be designed against,
// and a client that retries until something sticks destroys exactly that
// measurement.
//
// THE PROMPT IS NOT A TRUST BOUNDARY. It carries repo-derived catalog content
// and the caller's own instruction and table_state — no third-party untrusted
// content — so the caller and the adversary are the same party, and a caller
// who wants to read `users` can simply ask. The boundary is the resolver.
// Prompt-level defenses are deliberately absent. Two residuals to keep in mind
// downstream: the audit table stores raw instruction text, which is a stored-
// injection surface for any future agent that reads it, and LLM-authored labels
// reach the SPA safely only because React escapes by default — nothing on that
// path may use `dangerouslySetInnerHTML`.

import debug from 'debug'

import { call_inference } from '#libs-server/inference/inference-client.mjs'
import { get_data_view_generation_catalog } from './build-data-view-generation-catalog.mjs'
import {
  resolve_generated_table_state,
  format_resolver_errors,
  ROW_AXES
} from './resolve-generated-table-state.mjs'

const log = debug('generate-data-view')

// Above this, a param's value list is summarised rather than listed. The point
// is prompt budget, and the cut is per-param rather than global so that the
// short enumerations that carry the most meaning -- play_type, seas_type,
// team_unit -- stay complete.
const MAX_LISTED_PARAM_VALUES = 40

export const GENERATION_OUTCOMES = {
  resolved: 'resolved',
  resolved_after_repair: 'resolved_after_repair',
  // The model said the registry cannot express this. A first-class answer, not
  // an error: it is the measurement the SQL tier is designed against.
  inexpressible: 'inexpressible',
  // Two resolver failures. Also a fall-through, and a worse one -- the model
  // believed it could express the request and was wrong twice.
  unresolved: 'unresolved'
}

/**
 * The JSON schema the provider is constrained to. Structural only: whether the
 * ids inside are real is the resolver's question, and asking the schema to
 * carry a 597-value enum would blow the prompt and still not cover params.
 */
export const generated_table_state_schema = {
  type: 'object',
  // explanation and inexpressible_reason are REQUIRED, not optional, and that
  // is the difference between an audit that measures something and one that
  // records a bare false. Left optional, the model filled neither: three live
  // runs produced two `expressible: false` answers with no reason at all, and
  // the reason is the entire design input the SQL tier is meant to be built
  // from. An empty string is the answer for the field that does not apply.
  required: ['expressible', 'explanation', 'inexpressible_reason'],
  additionalProperties: false,
  properties: {
    expressible: {
      type: 'boolean',
      description:
        'false when the request cannot be expressed with the given columns and params'
    },
    inexpressible_reason: {
      type: 'string',
      description:
        'when expressible is false, what the catalog was missing; otherwise an empty string'
    },
    explanation: {
      type: 'string',
      description: 'one sentence describing the view, shown to the user'
    },
    table_state: {
      type: 'object',
      additionalProperties: false,
      // Measured against the 189 described production views: every one carries
      // row_grain and prefix_columns, and the schema permitted neither, so no
      // generated view could ever have the shape a real one has. `limit` was
      // the mirror defect -- permitted, reached for by the model, and used by
      // zero real views -- so it is gone rather than left as a field whose only
      // effect is to truncate an answer nobody asked to truncate.
      required: ['row_grain', 'prefix_columns', 'columns'],
      properties: {
        // Which entity a row is. Everything else in the view is read against
        // it, so it is not inferable after the fact from the column list.
        row_grain: {
          type: 'array',
          items: { type: 'string', enum: ['player', 'team'] }
        },
        // Identity columns, pinned to the left. Bare column ids, no params.
        prefix_columns: {
          type: 'array',
          items: { type: 'string' }
        },
        columns: {
          type: 'array',
          items: {
            type: 'object',
            required: ['column_id'],
            additionalProperties: false,
            properties: {
              column_id: { type: 'string' },
              params: { type: 'object' }
            }
          }
        },
        where: {
          type: 'array',
          items: {
            type: 'object',
            required: ['column_id', 'operator'],
            additionalProperties: false,
            properties: {
              column_id: { type: 'string' },
              operator: { type: 'string' },
              value: {},
              params: { type: 'object' }
            }
          }
        },
        sort: {
          type: 'array',
          items: {
            type: 'object',
            required: ['column_id'],
            additionalProperties: false,
            properties: {
              column_id: { type: 'string' },
              desc: { type: 'boolean' },
              params: { type: 'object' }
            }
          }
        },
        row_axes: {
          type: 'array',
          items: { type: 'string', enum: ROW_AXES }
        }
      }
    }
  }
}

const format_param = ({ param }) => {
  const parts = [`${param.param_key} (${param.data_type || 'any'})`]

  if (param.data_type === 'RANGE' && param.min !== undefined) {
    parts.push(`range ${param.min}..${param.max}`)
  } else if (param.values) {
    parts.push(
      param.values.length > MAX_LISTED_PARAM_VALUES
        ? `${param.values.length} values, e.g. ${param.values.slice(0, 6).join(', ')}`
        : param.values.join(', ')
    )
  }

  if (param.dynamic_types?.length) {
    parts.push(`dynamic: ${param.dynamic_types.join(', ')}`)
  }

  return `- ${parts.join(' | ')}`
}

/**
 * The catalog as prompt text.
 *
 * Columns carry their prose description because those 523 hand-written lines
 * are the highest-value prompting asset in the repo -- they are what lets a
 * user name a measure by meaning rather than by id.
 *
 * @param {object} [params]
 * @param {object} [params.catalog]
 * @returns {string}
 */
export const build_catalog_prompt = ({
  catalog = get_data_view_generation_catalog()
} = {}) => {
  const columns = catalog.columns
    .map((column) =>
      column.description
        ? `${column.column_id}: ${column.description}`
        : column.column_id
    )
    .join('\n')

  const params = Object.values(catalog.params)
    .map((param) => format_param({ param }))
    .join('\n')

  return [
    '# Columns',
    '',
    columns,
    '',
    '# Params',
    '',
    'Any column may carry params. These are the shared ones; a column may accept others.',
    '',
    params
  ].join('\n')
}

// The shape half of the prompt, and it was the missing half.
//
// The catalog teaches the model WHICH ids exist and nothing about how a
// table_state is spelled, so the model was emitting bare column lists: across a
// whole scored run it produced no `where` clause at all and left `params` empty
// on nearly every column, against a corpus where 188 of 189 human views filter
// and every one of them parameterises. It also invented param value shapes
// wholesale -- `{"type":"TEMPLATED","value":"last_n_years","args":{"n":5}}`
// where the real spelling is a one-element array carrying a `dynamic_type`.
//
// The example is synthetic on purpose. Real saved views are the user's own
// content and this repository is public, so the demonstration is authored here
// from real column ids and the measured param spellings rather than lifted from
// the corpus. Counts below are from the 189 described production views.
const SHAPE_PROMPT = [
  '# Shape',
  '',
  'A param value is an ARRAY, even for a single value: {"year": [2024]}. Two exceptions:',
  '- `output` is an OBJECT: {"period": "game", "aggregation": "rate", "threshold": null}. Use it whenever the instruction asks for a per-game or per-play rate rather than a total.',
  '- A value that depends on when the view is read is an object inside the array: {"nfl_week_id": [{"dynamic_type": "current_nfl_week"}]}.',
  '',
  'Filters go in `where`, and most views have them — a request naming a position, a threshold, or a season is asking for a filter, not just a column. Operators, most used first: IN, >=, IS NOT NULL, >, =, <, !=, <=.',
  '',
  'A complete example:',
  '',
  JSON.stringify(
    {
      row_grain: ['player'],
      prefix_columns: ['player_name', 'player_position', 'player_nfl_teams'],
      columns: [
        {
          column_id: 'player_receiving_yards_from_plays',
          params: {
            year: [2024],
            output: { period: 'game', aggregation: 'rate', threshold: null }
          }
        },
        { column_id: 'player_games_played', params: { year: [2024] } }
      ],
      where: [
        {
          column_id: 'player_position',
          operator: 'IN',
          value: ['WR'],
          params: {}
        },
        {
          column_id: 'player_games_played',
          operator: '>=',
          value: '8',
          params: { year: [2024] }
        }
      ],
      sort: [{ column_id: 'player_receiving_yards_from_plays', desc: true }],
      row_axes: []
    },
    null,
    2
  )
].join('\n')

const SYSTEM_PROMPT = [
  'You build data view definitions for a fantasy football analytics table.',
  '',
  'You are given a catalog of columns and params. Return a table_state that answers the user instruction.',
  '',
  'Rules:',
  '- Use ONLY column ids that appear verbatim in the catalog. Never invent one, and never guess at a plausible-looking id.',
  '- Always build the view. Search the catalog for the closest columns and use them.',
  '- Set expressible to false ONLY when nothing in the catalog is even close — no measure, no proxy, no related column. This is a last resort, not an alternative to reading the catalog.',
  '- row_grain says whether a row is a player or a team, and every view needs one.',
  '- Put identity columns in prefix_columns: player_name, player_position and player_nfl_teams for a player view, team_code and team_name for a team view.',
  '- Prefer fewer, well-chosen columns over many.',
  '- Parameterise every measure column the instruction constrains — a season, a week, a per-game rate. An unparameterised measure answers a different question from the one asked.',
  '- row_axes splits rows by a dimension and the only two are year and week. Leave it empty for a single-row-per-player view.',
  '- sort on the column the instruction is really asking about, descending unless the instruction implies otherwise.',
  '',
  SHAPE_PROMPT
].join('\n')

/**
 * @param {object} params
 * @param {string} params.instruction
 * @param {object} [params.current_table_state]
 * @param {string} [params.catalog_prompt]
 * @returns {string}
 */
export const build_generation_prompt = ({
  instruction,
  current_table_state,
  catalog_prompt = build_catalog_prompt()
}) =>
  [
    catalog_prompt,
    '',
    '# Current view',
    '',
    current_table_state
      ? `The user is editing this view. Return the COMPLETE new state, not a patch.\n\n${JSON.stringify(current_table_state)}`
      : 'None. The user is starting fresh.',
    '',
    '# Instruction',
    '',
    instruction
  ].join('\n')

/**
 * Generate a resolved `table_state` for one instruction.
 *
 * @param {object} params
 * @param {string} params.instruction
 * @param {object} [params.current_table_state]
 * @param {object} [params.catalog]
 * @param {string} [params.catalog_prompt] - reused across a harness run
 * @param {(request: object) => Promise<object>} [params.call] - injected for tests
 * @param {object} [params.inference_options]
 * @returns {Promise<object>}
 */
export const generate_data_view = async ({
  instruction,
  current_table_state,
  catalog = get_data_view_generation_catalog(),
  catalog_prompt,
  call = call_inference,
  inference_options = {}
}) => {
  const started_at = Date.now()
  const prompt = build_generation_prompt({
    instruction,
    current_table_state,
    catalog_prompt: catalog_prompt || build_catalog_prompt({ catalog })
  })

  const attempts = []

  const ask = async (user_prompt) => {
    const result = await call({
      system: SYSTEM_PROMPT,
      prompt: user_prompt,
      schema: generated_table_state_schema,
      ...inference_options
    })
    attempts.push({ duration_ms: result.duration_ms })
    return result
  }

  const first = await ask(prompt)

  const finish = ({ outcome, table_state, errors, explanation, reason }) => ({
    outcome,
    resolved:
      outcome === GENERATION_OUTCOMES.resolved ||
      outcome === GENERATION_OUTCOMES.resolved_after_repair,
    table_state: table_state || null,
    explanation: explanation || null,
    inexpressible_reason: reason || null,
    errors: errors || [],
    duration_ms: Date.now() - started_at,
    model_calls: attempts.length
  })

  if (first.output.expressible === false) {
    log('inexpressible: %s', first.output.inexpressible_reason)
    return finish({
      outcome: GENERATION_OUTCOMES.inexpressible,
      reason: first.output.inexpressible_reason
    })
  }

  const first_resolution = resolve_generated_table_state({
    table_state: first.output.table_state,
    catalog
  })

  if (first_resolution.ok) {
    return finish({
      outcome: GENERATION_OUTCOMES.resolved,
      table_state: first.output.table_state,
      explanation: first.output.explanation
    })
  }

  log('resolver rejected %d, one repair round', first_resolution.errors.length)

  const repair = await ask(
    [
      prompt,
      '',
      '# Your previous answer was rejected',
      '',
      JSON.stringify(first.output.table_state),
      '',
      'Every one of these is wrong. Fix them, or set expressible to false if the catalog cannot express the instruction:',
      '',
      format_resolver_errors({ errors: first_resolution.errors })
    ].join('\n')
  )

  if (repair.output.expressible === false) {
    return finish({
      outcome: GENERATION_OUTCOMES.inexpressible,
      reason: repair.output.inexpressible_reason
    })
  }

  const repair_resolution = resolve_generated_table_state({
    table_state: repair.output.table_state,
    catalog
  })

  if (repair_resolution.ok) {
    return finish({
      outcome: GENERATION_OUTCOMES.resolved_after_repair,
      table_state: repair.output.table_state,
      explanation: repair.output.explanation
    })
  }

  return finish({
    outcome: GENERATION_OUTCOMES.unresolved,
    errors: repair_resolution.errors
  })
}

export default generate_data_view
