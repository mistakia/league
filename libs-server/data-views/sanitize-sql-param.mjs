// A handful of column definitions splice `params` values directly into SQL
// text rather than passing them as knex bindings -- into value position, and
// for dynamic columns into IDENTIFIER position, where no quoting scheme
// applies at all and escaping would not help.
//
// `table_state_validator` does not cover this. Its params schema
// (`params_with_output_schema` in libs-server/validators.mjs) declares only the
// `output` key and is not `$$strict`, so every other params key arrives from
// the request as arbitrary JSON. `POST /api/data-views/search` is
// unauthenticated, so that is a direct request-to-SQL path.
//
// Enumerating every params key in the validator is not viable -- real saved
// views use 75 distinct keys and each new column param would add another. So
// the boundary lives here instead, at the point of use, and each splice site
// declares the shape it actually needs.

export const invalid_param = ({ param_name }) => {
  const error = new Error(`invalid data view param: ${param_name}`)
  // Routes map this to 400 rather than 500 -- it is a bad request, not a
  // server fault. The offending value is deliberately not echoed back.
  error.is_invalid_param = true
  throw error
}

// Postgres identifiers as these columns build them: lowercase word characters
// only. This is what makes identifier-position splicing safe -- a value that
// matches cannot carry a quote, space, comma, parenthesis or comment marker, so
// it cannot escape the identifier it is being used as. An unknown-but-wellformed
// name yields a plain "column does not exist" error rather than injection.
const sql_identifier_pattern = /^[a-z][a-z0-9_]*$/

export const sql_identifier_param = ({ value, param_name }) => {
  if (typeof value !== 'string' || !sql_identifier_pattern.test(value)) {
    invalid_param({ param_name })
  }
  return value
}

// Integer-valued params (year, week, lid, contract_year). Accepts a numeric
// string because saved views store some of these as strings, but returns a
// number so the caller splices a number and never the original text.
export const sql_integer_param = ({ value, param_name }) => {
  const parsed =
    typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isInteger(parsed)) {
    invalid_param({ param_name })
  }
  return parsed
}

// Format ids (league_format_id, scoring_format_id) spliced inside quotes.
// Production carries both shapes: 836 UUIDs and 22 slugs such as
// `genesis_10_team`, so this admits the dash a UUID needs. It still cannot
// carry a quote, space, semicolon or comment marker.
const sql_slug_pattern = /^[a-z0-9][a-z0-9_-]{0,63}$/

export const sql_slug_param = ({ value, param_name }) => {
  if (typeof value !== 'string' || !sql_slug_pattern.test(value)) {
    invalid_param({ param_name })
  }
  return value
}
