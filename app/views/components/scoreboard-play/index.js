import { connect } from 'react-redux'

import { get_player_maps } from '@core/selectors'

import ScoreboardPlay from './scoreboard-play'

const mapStateToProps = (state) => ({
  playerMaps: get_player_maps(state)
})

export default connect(mapStateToProps)(ScoreboardPlay)
