import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { calculatePoints, groupBy } from '@libs-shared'
import { playerActions } from '@core/players'
import {
  getGamelogsForSelectedPlayer,
  getSelectedPlayer,
  getCurrentLeague
} from '@core/selectors'

import SelectedPlayerGamelogs from './selected-player-gamelogs'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  getGamelogsForSelectedPlayer,
  getCurrentLeague,
  (playerMap, gamelogs, league) => {
    const position = playerMap.get('pos')
    gamelogs = gamelogs.map((gamelog) => {
      let points
      if (!gamelog.points) {
        points = calculatePoints({ stats: gamelog, position, league })
      }

      return {
        ...gamelog,
        points: gamelog.points || points.total
      }
    })

    const years = groupBy(gamelogs, 'year')

    return { playerMap, years }
  }
)

const mapDispatchToProps = {
  load: playerActions.loadPlayerGamelogs
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SelectedPlayerGamelogs)
