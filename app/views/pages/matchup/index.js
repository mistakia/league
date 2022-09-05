import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp, appActions } from '@core/app'
import { getSelectedMatchup, matchupsActions } from '@core/matchups'
import { playerActions } from '@core/players'
import { scoreboardActions } from '@core/scoreboard'

import MatchupPage from './matchup'

const mapStateToProps = createSelector(
  getApp,
  getSelectedMatchup,
  (app, matchup) => ({ year: app.year, matchup })
)

const mapDispatchToProps = {
  loadMatchups: matchupsActions.loadMatchups,
  loadLeaguePlayers: playerActions.loadLeaguePlayers,
  selectYear: appActions.selectYear,
  selectMatchup: matchupsActions.select,
  selectWeek: scoreboardActions.selectWeek
}

export default connect(mapStateToProps, mapDispatchToProps)(MatchupPage)
