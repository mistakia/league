import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { roster_actions } from '@core/rosters'
import {
  getCurrentPlayers,
  getCutlistTotalSalary,
  getPlayers
} from '@core/selectors'

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
  add_transition_tag: roster_actions.add_transition_tag,
  update_transition_tag: roster_actions.update_transition_tag
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(TransitionConfirmation)
