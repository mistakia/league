import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import { Map } from 'immutable'

import { teamActions } from '@core/teams'
import {
  get_app,
  getCurrentLeague,
  getTeamsForCurrentLeague
} from '@core/selectors'
import { constants, calculatePercentiles } from '@libs-shared'

import StatsPage from './stats'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getTeamsForCurrentLeague,
  get_app,
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
