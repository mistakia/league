import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentPlayers } from '@core/selectors'
import { rosterActions } from '@core/rosters'

import ReserveConfirmation from './reserve-confirmation'

const mapStateToProps = createSelector(getCurrentPlayers, (team) => ({
  team
}))

const mapDispatchToProps = {
  reserve: rosterActions.reserve
}

export default connect(mapStateToProps, mapDispatchToProps)(ReserveConfirmation)
