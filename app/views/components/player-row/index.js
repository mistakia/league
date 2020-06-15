import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayers, playerActions } from '@core/players'

import PlayerRow from './player-row'

const mapStateToProps = createSelector(
  getPlayers,
  (players) => ({ selected: players.get('selected') })
)

const mapDispatchToProps = {
  select: playerActions.selectPlayer
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PlayerRow)
