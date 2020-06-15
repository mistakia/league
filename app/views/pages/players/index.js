import React from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getFilteredPlayers, getPlayers } from '@core/players'

import PlayersPage from './players'

const mapStateToProps = createSelector(
  getFilteredPlayers,
  getPlayers,
  (players, pState) => ({
    players,
    selected: pState.get('selected'),
    order: pState.get('order'),
    orderBy: pState.get('orderBy')
  })
)

export default connect(
  mapStateToProps
)(PlayersPage)
