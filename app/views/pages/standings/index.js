import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { team_actions } from '@core/teams'
import {
  get_overall_standings,
  get_app,
  get_current_league
} from '@core/selectors'

import StandingsPage from './standings'

const map_state_to_props = createSelector(
  get_overall_standings,
  get_app,
  get_current_league,
  (standings, app, league) => ({
    standings,
    year: app.year,
    league,
    division_teams_sorted: standings.divisionTeams.sortBy(
      (v, k) => k,
      (a, b) => a - b
    )
  })
)

const map_dispatch_to_props = {
  load_league_team_stats: team_actions.load_league_team_stats
}

export default connect(map_state_to_props, map_dispatch_to_props)(StandingsPage)
