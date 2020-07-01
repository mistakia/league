import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayers, playerActions, getGamesByYearForPlayer } from '@core/players'

import PlayerRow from './player-row'

const mapStateToProps = createSelector(
  getPlayers,
  getGamesByYearForPlayer,
  (players, stats) => ({ selected: players.get('selected'), stats })
)

const mapDispatchToProps = {
  select: playerActions.selectPlayer,
  deselect: playerActions.deselectPlayer,
  delete: playerActions.deleteProjection
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PlayerRow)
