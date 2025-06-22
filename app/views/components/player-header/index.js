import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayers } from '@core/selectors'
import { playerActions } from '@core/players'

import PlayerHeader from './player-header'

const mapStateToProps = createSelector(getPlayers, (players) => ({
  order: players.get('order'),
  orderBy: players.get('orderBy')
}))

const mapDispatchToProps = {
  toggle_players_page_order: playerActions.toggle_players_page_order
}

export default connect(mapStateToProps, mapDispatchToProps)(PlayerHeader)
