import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  calculateDstStatsFromPlays,
  calculateStatsFromPlayStats,
  groupBy,
  fixTeam,
  constants,
  calculatePoints
} from '@common'
import { getSelectedPlayer } from '@core/players'
import { getPlaysForSelectedPlayer } from '@core/plays'
import { getCurrentLeague } from '@core/leagues'

import SelectedPlayerGamelogs from './selected-player-gamelogs'

const mapStateToProps = createSelector(
  getPlaysForSelectedPlayer,
  getSelectedPlayer,
  getCurrentLeague,
  (plays, player, league) => {
    const group = groupBy(plays.toJS(), 'week')
    const pos = player.pos1
    const gamelogs = []
    for (const week in group) {
      const weekPlays = group[week]
      const playStats = weekPlays.flatMap(p => p.playStats)
      const stats = pos === 'DST'
        ? calculateDstStatsFromPlays(weekPlays, player.team)
        : calculateStatsFromPlayStats(playStats)

      const play = weekPlays.find(p => p.possessionTeam)
      const opp = fixTeam(player.team) === fixTeam(play.homeTeamAbbr)
        ? fixTeam(play.awayTeamAbbr)
        : fixTeam(play.homeTeamAbbr)
      const points = calculatePoints({ stats, position: player.pos1, league })
      gamelogs.push({
        player: player.player,
        week,
        year: constants.season.year,
        total: points.total,
        pos,
        opp,
        ...stats
      })
    }

    return { gamelogs, player }
  }
)

export default connect(
  mapStateToProps
)(SelectedPlayerGamelogs)
