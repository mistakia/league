import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getFilteredPlayers, getPlayers, playerActions } from '@core/players'

import PlayersPage from './players'

const mapStateToProps = createSelector(
  getFilteredPlayers,
  getPlayers,
  getApp,
  (players, pState, app) => ({
    players,
    vbaseline: app.vbaseline,
    searchValue: pState.get('search'),
    selected: pState.get('selected'),
    order: pState.get('order'),
    orderBy: pState.get('orderBy')
  })
)

const mapDispatchToProps = {
  search: playerActions.search
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PlayersPage)
