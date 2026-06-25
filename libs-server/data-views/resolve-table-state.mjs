import db from '#db'

const SHORT_URL_HASH_PATTERN = /\/u\/([a-f0-9]{32})/
const BARE_HASH_PATTERN = /^[a-f0-9]{32}$/

export const extract_short_url_hash = (input) => {
  if (BARE_HASH_PATTERN.test(input)) return input
  const match = input.match(SHORT_URL_HASH_PATTERN)
  if (!match) {
    throw new Error(
      'Invalid short URL format. Expected: /u/{hash}, full URL containing /u/{hash}, or a bare 32-character hash'
    )
  }
  return match[1]
}

export const parse_url_to_table_state = (full_url) => {
  const url_obj = new URL(full_url)
  const params = new URLSearchParams(url_obj.search)

  const table_state = {
    columns: [],
    prefix_columns: [],
    where: [],
    sort: [],
    row_axes: [],
    offset: 0,
    limit: 500
  }

  const json_params = ['columns', 'prefix_columns', 'where', 'sort', 'row_axes', 'row_grain']
  for (const param of json_params) {
    if (params.has(param)) {
      try {
        table_state[param] = JSON.parse(params.get(param))
      } catch (error) {
        throw new Error(`Failed to parse ${param} parameter: ${error.message}`)
      }
    }
  }

  if (params.has('offset')) {
    table_state.offset = parseInt(params.get('offset'), 10) || 0
  }
  if (params.has('limit')) {
    table_state.limit = parseInt(params.get('limit'), 10) || 500
  }

  return table_state
}

export const resolve_table_state_from_short_url = async (short_url) => {
  const hash = extract_short_url_hash(short_url)
  const row = await db('urls').where('url_hash', hash).first()
  if (!row) {
    throw new Error(`Short URL hash not found in database: ${hash}`)
  }
  return { table_state: parse_url_to_table_state(row.url), hash, url: row.url }
}
