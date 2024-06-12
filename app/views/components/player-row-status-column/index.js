import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerStatus } from '@core/selectors'

import PlayerRowStatusColumn from './player-row-status-column'

const mapStateToProps = createSelector(
  (state, { row }) => getPlayerStatus(state, { pid: row.original.pid }),
  (status) => ({ status })
)

export default connect(mapStateToProps)(PlayerRowStatusColumn)
