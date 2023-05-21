import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { contextMenuActions } from '@core/context-menu'
import { get_context_menu_info } from '@core/selectors'
import ContextMenu from './context-menu'

const mapStateToProps = createSelector(
  get_context_menu_info,
  (contextMenuInfo) => ({ contextMenuInfo })
)

const mapDispatchToProps = {
  hide: contextMenuActions.hide
}

export default connect(mapStateToProps, mapDispatchToProps)(ContextMenu)
