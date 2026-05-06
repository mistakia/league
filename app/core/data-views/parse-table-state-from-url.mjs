import {
  migrate_entries_array,
  migrate_sort_array
} from '../../../libs-shared/data-views-nfl-week-migration.mjs'

const parse_param = (search_params, key) =>
  JSON.parse(search_params.get(key) || 'null') || []

export default function parse_table_state_from_url(search_params) {
  const columns = migrate_entries_array(parse_param(search_params, 'columns'))
  const prefix_columns = migrate_entries_array(
    parse_param(search_params, 'prefix_columns')
  )
  const where = migrate_entries_array(parse_param(search_params, 'where'))
  const sort = migrate_sort_array(parse_param(search_params, 'sort'))
  const splits = parse_param(search_params, 'splits')
  const view_name = search_params.get('view_name') || ''
  const view_search_column_id = search_params.get('view_search_column_id') || ''
  const view_description = search_params.get('view_description') || ''

  return {
    columns,
    prefix_columns,
    where,
    sort,
    splits,
    view_name,
    view_search_column_id,
    view_description
  }
}
