import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { app_actions } from '@core/app'
import { get_app, get_selected_matchup, get_scoreboard } from '@core/selectors'
import { matchups_actions } from '@core/matchups'
import { player_actions } from '@core/players'
import { scoreboard_actions } from '@core/scoreboard'
import { roster_actions } from '@core/rosters'
import { seasons_actions } from '@core/seasons'

import MatchupPage from './matchup'

const map_state_to_props = createSelector(
  (state) => state.getIn(['matchups', 'isPending']),
  get_app,
  get_scoreboard,
  get_selected_matchup,
  (is_loading, app, scoreboard, matchup) => ({
    is_loading,
    year: app.year,
    week: scoreboard.get('week'),
    matchup
  })
)

const map_dispatch_to_props = {
  load_rosters_for_year: roster_actions.load_rosters_for_year,
  loadMatchups: matchups_actions.loadMatchups,
  load_league_players: player_actions.load_league_players,
  select_year: app_actions.select_year,
  select_matchup: matchups_actions.select_matchup,
  select_week: scoreboard_actions.select_week,
  load_season: seasons_actions.load_season
}

export default connect(map_state_to_props, map_dispatch_to_props)(MatchupPage)
