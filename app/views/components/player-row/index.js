import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getPlayers, playerActions, getGamesByYearForPlayer } from '@core/players'

import PlayerRow from './player-row'

const mapStateToProps = createSelector(
  getPlayers,
  getApp,
  getGamesByYearForPlayer,
  (players, app, stats) => ({
    selected: players.get('selected'),
    stats,
    vbaseline: app.vbaseline
  })
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
