import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerFields } from '@core/selectors'

import PlayersViewManager from './players-view-manager'

const mapStateToProps = createSelector(getPlayerFields, (fields) => ({
  fields
}))

export default connect(mapStateToProps)(PlayersViewManager)
