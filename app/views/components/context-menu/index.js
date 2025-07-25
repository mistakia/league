import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { context_menu_actions } from '@core/context-menu'
import { get_context_menu_info } from '@core/selectors'
import ContextMenu from './context-menu'

const map_state_to_props = createSelector(
  get_context_menu_info,
  (contextMenuInfo) => ({ contextMenuInfo })
)

const map_dispatch_to_props = {
  hide: context_menu_actions.hide
}

export default connect(map_state_to_props, map_dispatch_to_props)(ContextMenu)
