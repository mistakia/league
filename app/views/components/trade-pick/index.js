import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/leagues'

import TradePick from './trade-pick'

const mapStateToProps = createSelector(
  getCurrentLeague,
  (league) => ({ league })
)

export default connect(
  mapStateToProps
)(TradePick)
