import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import { Map } from 'immutable'

import { getTeamsForCurrentLeague, teamActions } from '@core/teams'
import { getCurrentLeague } from '@core/leagues'
import { getApp } from '@core/app'
import { constants, calculatePercentiles } from '@common'

import StatsPage from './stats'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getTeamsForCurrentLeague,
  getApp,
  (league, teams, app) => {
    const year = app.year
    // TODO - add prefix
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

const mapDispatchToProps = {
  loadLeagueTeamStats: teamActions.loadLeagueTeamStats
}

export default connect(mapStateToProps, mapDispatchToProps)(StatsPage)
