import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerFields } from '@core/selectors'

import PlayersViewManager from './players-view-manager'

const mapStateToProps = createSelector(
  (state) => state.getIn(['players', 'views']),
  getPlayerFields,
  (views, fields) => ({ views, fields })
)

export default connect(mapStateToProps)(PlayersViewManager)
