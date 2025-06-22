import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { roster_actions } from '@core/rosters'
import { getCurrentLeague } from '@core/selectors'

import Lineup from './lineup'

const mapStateToProps = createSelector(getCurrentLeague, (league) => ({
  league
}))

const mapDispatchToProps = {
  update: roster_actions.update
}

export default connect(mapStateToProps, mapDispatchToProps)(Lineup)
