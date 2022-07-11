import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import { Map } from 'immutable'

import { getTeamsForCurrentLeague } from '@core/teams'
import { getCurrentLeague } from '@core/leagues'
import { getStandingsYear } from '@core/standings'
import { constants, calculatePercentiles } from '@common'

import StatsPage from './stats'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getTeamsForCurrentLeague,
  getStandingsYear,
  (league, teams, year) => {
    const percentiles = calculatePercentiles({
      items: teams
        .map((t) =>
          t.getIn(['stats', year], new Map(constants.createFantasyTeamStats()))
        )
        .toList()
        .toJS(),
      stats: constants.fantasyTeamStats
    })

    return {
      league,
      teams,
      percentiles,
      year
    }
  }
)

export default connect(mapStateToProps)(StatsPage)
