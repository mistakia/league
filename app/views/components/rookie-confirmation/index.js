import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/leagues'
import { rosterActions } from '@core/rosters'

import RookieConfirmation from './rookie-confirmation'

const mapStateToProps = createSelector(getCurrentLeague, (league) => ({
  league
}))

const mapDispatchToProps = {
  tag: rosterActions.tag
}

export default connect(mapStateToProps, mapDispatchToProps)(RookieConfirmation)
