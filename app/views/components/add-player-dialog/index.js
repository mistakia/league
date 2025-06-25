import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { roster_actions } from '@core/rosters'
import {
  getAvailablePlayersForCurrentLeague,
  getRostersForCurrentLeague,
  getCurrentLeague
} from '@core/selectors'

import AddPlayerDialog from './add-player-dialog'

const mapStateToProps = createSelector(
  getAvailablePlayersForCurrentLeague,
  getRostersForCurrentLeague,
  getCurrentLeague,
  (players, rosters, league) => ({ players, rosters, league })
)

const mapDispatchToProps = {
  add: roster_actions.add
}

export default connect(mapStateToProps, mapDispatchToProps)(AddPlayerDialog)
