import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { appActions } from '@core/app'
import { get_app, getSelectedMatchup, getScoreboard } from '@core/selectors'
import { matchupsActions } from '@core/matchups'
import { playerActions } from '@core/players'
import { scoreboardActions } from '@core/scoreboard'
import { rosterActions } from '@core/rosters'

import MatchupPage from './matchup'

const mapStateToProps = createSelector(
  (state) => state.getIn(['matchups', 'isPending']),
  get_app,
  getScoreboard,
  getSelectedMatchup,
  (is_loading, app, scoreboard, matchup) => ({
    is_loading,
    year: app.year,
    week: scoreboard.get('week'),
    matchup
  })
)

const mapDispatchToProps = {
  load_rosters_for_year: rosterActions.load_rosters_for_year,
  loadMatchups: matchupsActions.loadMatchups,
  loadLeaguePlayers: playerActions.loadLeaguePlayers,
  selectYear: appActions.selectYear,
  select_matchup: matchupsActions.select_matchup,
  selectWeek: scoreboardActions.selectWeek
}

export default connect(mapStateToProps, mapDispatchToProps)(MatchupPage)
