import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { appActions } from '@core/app'
import { get_app, getSelectedMatchup } from '@core/selectors'
import { matchupsActions } from '@core/matchups'
import { playerActions } from '@core/players'
import { scoreboardActions } from '@core/scoreboard'
import { rosterActions } from '@core/rosters'

import MatchupPage from './matchup'

const mapStateToProps = createSelector(
  get_app,
  getSelectedMatchup,
  (app, matchup) => ({ year: app.year, matchup })
)

const mapDispatchToProps = {
  loadRosters: rosterActions.loadRosters,
  loadMatchups: matchupsActions.loadMatchups,
  loadLeaguePlayers: playerActions.loadLeaguePlayers,
  selectYear: appActions.selectYear,
  selectMatchup: matchupsActions.select,
  selectWeek: scoreboardActions.selectWeek
}

export default connect(mapStateToProps, mapDispatchToProps)(MatchupPage)
