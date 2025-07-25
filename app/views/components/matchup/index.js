import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_teams_for_current_league,
  getScoreboardByMatchupId
} from '@core/selectors'

import Matchup from './matchup'

const map_dispatch_to_props = createSelector(
  get_teams_for_current_league,
  getScoreboardByMatchupId,
  (teams, scoreboard) => ({ teams, scoreboard })
)

export default connect(map_dispatch_to_props)(Matchup)
