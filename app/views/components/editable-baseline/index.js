import { Map } from 'immutable'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getPlayers, getPlayersByPosition, playerActions } from '@core/players'

import EditableBaseline from './editable-baseline'

const mapStateToProps = createSelector(
  getPlayers,
  getPlayersByPosition, // TODO - get multiple positions if league has flex positions
  getApp,
  (pState, players, app) => ({
    baselines: pState.getIn(['baselines', '0'], new Map()).toJS(),
    vbaseline: app.vbaseline,
    players
  })
)

const mapDispatchToProps = {
  update: playerActions.updateBaseline
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(EditableBaseline)
