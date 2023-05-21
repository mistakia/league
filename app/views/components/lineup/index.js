import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { rosterActions } from '@core/rosters'
import { getCurrentLeague } from '@core/selectors'

import Lineup from './lineup'

const mapStateToProps = createSelector(getCurrentLeague, (league) => ({
  league
}))

const mapDispatchToProps = {
  update: rosterActions.update
}

export default connect(mapStateToProps, mapDispatchToProps)(Lineup)
