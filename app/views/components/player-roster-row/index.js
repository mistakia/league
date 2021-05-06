import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById } from '@core/players'

import PlayerRosterRow from './player-roster-row'

const mapStateToProps = createSelector(getPlayerById, (player) => ({ player }))

export default connect(mapStateToProps)(PlayerRosterRow)
