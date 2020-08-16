import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerProjectedContribution } from '@core/rosters'

import PlayerRoster from './player-roster'

const mapStateToProps = createSelector(
  getPlayerProjectedContribution,
  (projected) => ({ projected })
)

export default connect(
  mapStateToProps
)(PlayerRoster)
