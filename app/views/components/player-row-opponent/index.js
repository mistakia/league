import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getGameByTeam } from '@core/selectors'

import PlayerRowOpponent from './player-row-opponent'

const mapStateToProps = createSelector(getGameByTeam, (game) => ({ game }))

export default connect(mapStateToProps)(PlayerRowOpponent)
