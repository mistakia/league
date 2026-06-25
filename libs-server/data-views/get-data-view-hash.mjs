import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'

export default function get_data_view_hash({
  row_axes = [],
  where = [],
  columns = [],
  prefix_columns = [],
  sort = [],
  offset = 0,
  limit = 500
}) {
  return get_table_hash(
    JSON.stringify({
      row_axes,
      where,
      columns,
      prefix_columns,
      sort,
      offset,
      limit
    })
  )
}
