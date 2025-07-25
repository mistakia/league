import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerStatus } from '@core/selectors'

import PlayerRowStatusColumn from './player-row-status-column'

const map_state_to_props = createSelector(
  (state, { row }) => getPlayerStatus(state, { pid: row.original.pid }),
  (status) => ({ status })
)

export default connect(map_state_to_props)(PlayerRowStatusColumn)
