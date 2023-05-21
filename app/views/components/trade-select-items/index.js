import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamsForCurrentLeague } from '@core/selectors'

import TradeSelectItems from './trade-select-items'

const mapStateToProps = createSelector(getTeamsForCurrentLeague, (teams) => ({
  teams
}))

export default connect(mapStateToProps)(TradeSelectItems)
