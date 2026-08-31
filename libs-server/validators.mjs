import Validator from 'fastest-validator'

import { current_season } from '#constants'

const v = new Validator({
  haltOnFirstError: true,
  useNewCustomCheckerFunction: true
})

const league_id_schema = {
  type: 'number',
  integer: true,
  positive: true,
  $$root: true
}
export const league_id_validator = v.compile(league_id_schema)

const year_schema = {
  type: 'number',
  integer: true,
  positive: true,
  min: 1920,
  max: current_season.year,
  $$root: true
}

export const year_validator = v.compile(year_schema)

const week_schema = {
  type: 'number',
  integer: true,
  positive: true,
  min: 1,
  max: 30,
  $$root: true
}

export const week_validator = v.compile(week_schema)

const season_type_schema = {
  type: 'string',
  enum: ['PRE', 'REG', 'POST'],
  $$root: true
}

export const season_type_validator = v.compile(season_type_schema)

const view_name_schema = {
  $$root: true,
  type: 'string',
  min: 1,
  max: 255
}
export const view_name_validator = v.compile(view_name_schema)

const view_description_schema = {
  $$root: true,
  type: 'string',
  min: 1,
  max: 1000
}
export const view_description_validator = v.compile(view_description_schema)

const sort_schema = {
  type: 'array',
  items: {
    type: 'object',
    props: {
      column_id: { type: 'string' },
      desc: { type: 'boolean' }
    }
  },
  $$root: true,
  optional: true
}
export const sort_validator = v.compile(sort_schema)

const output_threshold_schema = {
  type: 'object',
  optional: true,
  props: {
    op: { type: 'string', enum: ['>=', '>', '<=', '<', '=', '!='] },
    value: { type: 'number' }
  }
}

const output_param_schema = {
  type: 'object',
  optional: true,
  props: {
    period: { type: 'string' },
    // `sum` is deliberately absent: it is the wire value for NO aggregation and
    // reaches here as an absent `output` rather than as a value. `mean` joins
    // `rate` and `count` with the per-period summary -- it divides by periods
    // CARRYING measure rows where `rate` divides by a denominator unit, so the
    // two are different measures and both are legal on one column.
    aggregation: { type: 'string', enum: ['rate', 'count', 'mean'] },
    threshold: output_threshold_schema
  },
  custom(value, errors) {
    if (!value) return value
    if (value.aggregation === 'count' && !value.threshold) {
      errors.push({
        type: 'outputCountRequiresThreshold',
        actual: value
      })
    }
    if (value.threshold && value.aggregation !== 'count') {
      errors.push({
        type: 'outputThresholdRequiresCount',
        actual: value
      })
    }
    return value
  }
}

const params_with_output_schema = {
  type: 'object',
  optional: true,
  props: {
    output: output_param_schema
  }
}

const columns_schema = {
  type: 'array',
  items: [
    {
      type: 'object',
      props: {
        column_id: { type: 'string' },
        params: params_with_output_schema
      }
    },
    {
      type: 'string'
    }
  ]
}
export const columns_validator = v.compile(columns_schema)

const where_operator_schema = {
  type: 'string',
  enum: [
    '=',
    '!=',
    '>',
    '>=',
    '<',
    '<=',
    'ILIKE',
    'NOT ILIKE',
    'LIKE',
    'NOT LIKE',
    'IS NULL',
    'IS NOT NULL',
    'IN',
    'NOT IN'
  ]
}

// Defense-in-depth for `where[].value`, which libs-server/data-views/where-string.mjs
// splices into single-quoted SQL text. The quote/semicolon/comment characters are
// what actually stop a break-out; the keyword list is a second layer.
//
// A RegExp rather than a string so the `i` flag applies: as a string this was
// compiled case-sensitively, so `drop` was rejected while `DROP` and `DeLeTe`
// passed -- the lowercase-only spelling being the one an attacker would not use.
// The flag makes the list mean what it says, at the cost of also rejecting a
// benign value that merely CONTAINS a keyword ("Drop Kings"); values carrying an
// apostrophe are already rejected by the same pattern, so that bar is not new.
//
// There was also a `match: /^[a-za-z0-9.]+$/` key on each rule. `match` is not a
// fastest-validator string rule (the string rules are pattern/contains/enum/
// alpha/alphanum/...), so it was silently ignored and enforced nothing. It is
// removed rather than activated: as written it admits neither uppercase (the
// range is a duplicated `a-z`) nor spaces, so switching it on would reject the
// ordinary league and team names these filters run against.
const where_value_pattern =
  /^(?!.*(?:delete|drop|truncate|alter|update|insert|merge|exec|;|--|'|"|=|<|>)).*$/i

const where_value_string_rule = {
  type: 'string',
  pattern: where_value_pattern,
  min: 0,
  max: 50
}

const where_schema = {
  type: 'array',
  items: {
    type: 'object',
    props: {
      column_id: { type: 'string' },
      operator: where_operator_schema,
      value: {
        optional: true,
        type: 'multi',
        rules: [
          where_value_string_rule,
          { type: 'number' },
          { type: 'array', items: where_value_string_rule },
          { type: 'array', items: { type: 'number' } }
        ]
      },
      params: params_with_output_schema
    }
  },
  $$root: true,
  optional: true
}

export const where_validator = v.compile(where_schema)

const offset_schema = {
  type: 'number',
  min: 0,
  optional: true,
  integer: true,
  $$root: true
}
export const offset_validator = v.compile(offset_schema)

// The ceiling every INTERACTIVE data-view path enforces -- the websocket, the
// search route, the plays view. It is a property of the caller, not of the
// query: only the export route raises it, and only for a caller presenting an
// export API key (libs-server/data-views/export-api-keys.mjs). Nothing that
// serves a browser table should page past this.
export const DATA_VIEW_DEFAULT_MAX_LIMIT = 2000

// `max_limit: null` means no ceiling. It is reachable only from the export
// route with a key whose max_export_rows is null.
const build_limit_schema = (max_limit) => ({
  type: 'number',
  optional: true,
  integer: true,
  min: 1,
  ...(max_limit === null ? {} : { max: max_limit }),
  $$root: true
})

const limit_schema = build_limit_schema(DATA_VIEW_DEFAULT_MAX_LIMIT)
export const limit_validator = v.compile(limit_schema)

const row_axes_schema = {
  type: 'array',
  items: {
    type: 'string'
  },
  $$root: true,
  optional: true
}

const row_grain_schema = {
  type: 'array',
  items: { type: 'string', enum: ['player', 'team'] },
  min: 1,
  max: 1,
  optional: true,
  default: ['player']
}

const build_table_state_schema = (limit) => ({
  offset: offset_schema,
  limit,
  sort: sort_schema,
  columns: columns_schema,
  where: where_schema,
  row_axes: row_axes_schema,
  row_grain: row_grain_schema
})

const table_state_schema = build_table_state_schema(limit_schema)
export const table_state_validator = v.compile(table_state_schema)

// Compiling a fastest-validator schema walks the whole column/where tree, so the
// per-ceiling validators are memoized rather than built per request. The key
// space is bounded by the configured API keys plus the default, not by anything
// a caller supplies.
const table_state_validators_by_max_limit = new Map([
  [DATA_VIEW_DEFAULT_MAX_LIMIT, table_state_validator]
])

/**
 * The table-state validator for a given limit ceiling.
 *
 * @param {object} [opts]
 * @param {number|null} [opts.max_limit] - null for no ceiling
 * @returns {(table_state: object) => true|Array<object>} compiled validator --
 *   true when valid, otherwise the array of field errors
 */
export const get_table_state_validator = ({
  max_limit = DATA_VIEW_DEFAULT_MAX_LIMIT
} = {}) => {
  const cached = table_state_validators_by_max_limit.get(max_limit)
  if (cached) return cached

  const validator = v.compile(
    build_table_state_schema(build_limit_schema(max_limit))
  )
  table_state_validators_by_max_limit.set(max_limit, validator)
  return validator
}

const short_url_schema = {
  type: 'string',
  format: 'url',
  minLength: 1,
  maxLength: 40480,
  $$root: true
}

export const short_url_validator = v.compile(short_url_schema)

const username_schema = {
  username: {
    type: 'string',
    min: 3,
    max: 20,
    pattern: /^[a-zA-Z0-9_]+$/,
    messages: {
      stringPattern:
        "The '{field}' field must contain only alphanumeric characters and underscores"
    }
  }
}

export const username_validator = v.compile(username_schema)

const email_schema = {
  email: {
    type: 'string',
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    messages: {
      stringPattern: 'Invalid email address'
    }
  }
}

export const email_validator = v.compile(email_schema)
