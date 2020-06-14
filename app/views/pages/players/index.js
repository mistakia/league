import React from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getFilteredPlayers } from '@core/players'

import PlayersPage from './players'

const mapStateToProps = createSelector(
  getFilteredPlayers,
  (players) => ({ players })
)

export default connect(
  mapStateToProps
)(PlayersPage)
