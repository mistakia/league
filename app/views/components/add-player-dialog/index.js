import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getAvailablePlayersForCurrentLeague,
  getRostersForCurrentLeague,
  rosterActions
} from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'

import AddPlayerDialog from './add-player-dialog'

const mapStateToProps = createSelector(
  getAvailablePlayersForCurrentLeague,
  getRostersForCurrentLeague,
  getCurrentLeague,
  (players, rosters, league) => ({ players, rosters, league })
)

const mapDispatchToProps = {
  add: rosterActions.add
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(AddPlayerDialog)
