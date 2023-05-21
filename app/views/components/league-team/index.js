import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getTeamById,
  getCurrentLeague,
  getRosterByTeamId,
  getGroupedPlayersByTeamId,
  isRestrictedFreeAgencyPeriod,
  isBeforeExtensionDeadline
} from '@core/selectors'
import { constants, calculatePercentiles, getExtensionAmount } from '@common'
import { playerActions } from '@core/players'

import LeagueTeam from './league-team'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getRosterByTeamId,
  getTeamById,
  getGroupedPlayersByTeamId,
  isRestrictedFreeAgencyPeriod,
  isBeforeExtensionDeadline,
  (
    league,
    roster,
    team,
    players,
    isRestrictedFreeAgencyPeriod,
    isBeforeExtensionDeadline
  ) => {
    const projectionType = constants.season.isRegularSeason ? 'ros' : '0'
    const items = []
    players.players.forEach((p) => {
      const value = p.get('value', 0)
      const tag = p.get('tag')
      const isRestrictedFreeAgent = tag === constants.tags.TRANSITION
      const bid = p.get('bid', 0)
      const extensions = p.get('extensions', 0)
      const pos = p.get('pos')
      const market_salary = p.getIn(['market_salary', '0'], 0)
      const extendedSalary = getExtensionAmount({
        pos,
        tag: isBeforeExtensionDeadline ? tag : constants.tags.REGULAR,
        extensions,
        league,
        value,
        bid
      })
      const savings =
        !isRestrictedFreeAgencyPeriod || bid || !isRestrictedFreeAgent
          ? market_salary -
            (isBeforeExtensionDeadline ? extendedSalary : bid || value)
          : null

      items.push({
        savings,
        market_salary,
        market_salary_adj: p.get('market_salary_adj', 0),
        projected_salary: p.getIn(['market_salary', projectionType], 0),
        vorp_adj: p.getIn(['vorp_adj', projectionType], 0)
      })
    })

    const percentiles = calculatePercentiles({
      items,
      stats: [
        'savings',
        'market_salary',
        'market_salary_adj',
        'projected_salary',
        'vorp_adj'
      ]
    })

    return {
      league,
      roster,
      picks: team.picks,
      players,
      percentiles
    }
  }
)

const mapDispatchToProps = {
  loadTeamPlayers: playerActions.loadTeamPlayers
}

export default connect(mapStateToProps, mapDispatchToProps)(LeagueTeam)
