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
  select: playerActions.selectPlayer
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PlayerRow)
