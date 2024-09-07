import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'

export default function get_data_view_hash({
  splits = [],
  where = [],
  columns = [],
  prefix_columns = [],
  sort = [],
  offset = 0,
  limit = 500
}) {
  return get_table_hash(
    JSON.stringify({
      splits,
      where,
      columns,
      prefix_columns,
      sort,
      offset,
      limit
    })
  )
}
