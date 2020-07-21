import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getPlayers, getPlayersByPosition, playerActions } from '@core/players'

import EditableBaseline from './editable-baseline'

const mapStateToProps = createSelector(
  getPlayers,
  getPlayersByPosition,
  getApp,
  (pState, players, app) => ({
    baselines: pState.get('baselines').toJS(),
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
