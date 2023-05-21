import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/selectors'

import LeagueHeader from './league-header'

const mapStateToProps = createSelector(getCurrentLeague, (league) => ({
  league
}))

export default connect(mapStateToProps)(LeagueHeader)
