import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerPositionFilter, playerActions } from '@core/players'

import PositionFilter from './position-filter'

const mapStateToProps = createSelector(
  getPlayerPositionFilter,
  (positions) => ({ positions })
)

const mapDispatchToProps = {
  filter: playerActions.filterPositions
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PositionFilter)
