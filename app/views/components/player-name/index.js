import { connect } from 'react-redux'

import { getPlayerById, get_players_state } from '@core/selectors'
import { player_actions } from '@core/players'

import PlayerName from './player-name'

const mapStateToProps = (state, ownProps) => {
  const player_map =
    ownProps.player_map || getPlayerById(state, { pid: ownProps.pid })
  const players = get_players_state(state)

  return {
    player_map,
    isOnCutlist: player_map
      ? players.get('cutlist').includes(player_map.get('pid'))
      : false
  }
}

const mapDispatchToProps = {
  select: player_actions.select_player
}

export default connect(mapStateToProps, mapDispatchToProps)(PlayerName)
