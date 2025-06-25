import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentPlayers } from '@core/selectors'
import { roster_actions } from '@core/rosters'

import ReserveConfirmation from './reserve-confirmation'

const mapStateToProps = createSelector(getCurrentPlayers, (team) => ({
  team
}))

const mapDispatchToProps = {
  reserve: roster_actions.reserve
}

export default connect(mapStateToProps, mapDispatchToProps)(ReserveConfirmation)
