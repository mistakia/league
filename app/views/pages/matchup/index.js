import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { appActions } from '@core/app'
import { get_app, getSelectedMatchup, getScoreboard } from '@core/selectors'
import { matchupsActions } from '@core/matchups'
import { player_actions } from '@core/players'
import { scoreboardActions } from '@core/scoreboard'
import { roster_actions } from '@core/rosters'
import { seasons_actions } from '@core/seasons'

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
  load_rosters_for_year: roster_actions.load_rosters_for_year,
  loadMatchups: matchupsActions.loadMatchups,
  load_league_players: player_actions.load_league_players,
  selectYear: appActions.selectYear,
  select_matchup: matchupsActions.select_matchup,
  selectWeek: scoreboardActions.selectWeek,
  load_season: seasons_actions.load_season
}

export default connect(mapStateToProps, mapDispatchToProps)(MatchupPage)
