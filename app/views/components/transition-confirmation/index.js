import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentPlayers, rosterActions } from '@core/rosters'
import { getCutlistTotalSalary, getPlayers } from '@core/players'

import TransitionConfirmation from './transition-confirmation'

const mapStateToProps = createSelector(
  getCurrentPlayers,
  getCutlistTotalSalary,
  getPlayers,
  (team, cutlistTotalSalary, players) => ({
    team,
    cutlistTotalSalary,
    cutlist: players.get('cutlist')
  })
)

const mapDispatchToProps = {
  addTransitionTag: rosterActions.addTransitionTag,
  updateTransitionTag: rosterActions.updateTransitionTag
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(TransitionConfirmation)
