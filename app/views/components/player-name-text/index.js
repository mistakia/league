import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById } from '@core/players'

import PlayerNameText from './player-name-text'

const mapStateToProps = createSelector(getPlayerById, (player) => ({ player }))

export default connect(mapStateToProps)(PlayerNameText)
