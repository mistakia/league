import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { rosterActions, getCurrentPlayers } from '@core/rosters'

import ReserveConfirmation from './reserve-confirmation'

const mapStateToProps = createSelector(getCurrentPlayers, (team) => ({
  team
}))

const mapDispatchToProps = {
  reserve: rosterActions.reserve
}

export default connect(mapStateToProps, mapDispatchToProps)(ReserveConfirmation)
