import { ROW_GRAIN_DEFAULTS } from '#libs-shared/row-grain-defaults.mjs'

export default {
  name: 'team',
  prefix_columns: ROW_GRAIN_DEFAULTS.team.prefix_columns,
  position_filter_field: null,
  base_identity: 'team'
}
