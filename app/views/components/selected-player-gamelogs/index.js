import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { calculatePoints } from '@common'
import { getSelectedPlayer, playerActions } from '@core/players'
import { getGamelogsForSelectedPlayer } from '@core/stats'
import { getCurrentLeague } from '@core/leagues'

import SelectedPlayerGamelogs from './selected-player-gamelogs'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  getGamelogsForSelectedPlayer,
  getCurrentLeague,
  (playerMap, gamelogs, league) => {
    const position = playerMap.get('pos')
    gamelogs = gamelogs.map((gamelog) => {
      const points = calculatePoints({ stats: gamelog, position, league })
      return {
        total: points.total,
        ...gamelog
      }
    })

    return { playerMap, gamelogs }
  }
)

const mapDispatchToProps = {
  load: playerActions.loadPlayerGamelogs
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SelectedPlayerGamelogs)
