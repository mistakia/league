import { ROW_GRAIN_DEFAULTS } from '#libs-shared/row-grain-defaults.mjs'

export default {
  name: 'player',
  prefix_columns: ROW_GRAIN_DEFAULTS.player.prefix_columns,
  position_filter_field: 'player_position',
  base_identity: 'player'
}
