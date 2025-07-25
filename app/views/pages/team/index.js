import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_teams_for_current_league } from '@core/selectors'
import { player_actions } from '@core/players'
import { team_actions } from '@core/teams'
import { draft_pick_value_actions } from '@core/draft-pick-value'
import { league_careerlogs_actions } from '@core/league-careerlogs'

import TeamPage from './team'

const map_state_to_props = createSelector(
  get_teams_for_current_league,
  (teams) => ({
    teams
  })
)

const map_dispatch_to_props = {
  load_teams: team_actions.load_teams,
  load_league_players: player_actions.load_league_players,
  load_draft_pick_value: draft_pick_value_actions.load_draft_pick_value,
  load_league_team_stats: team_actions.load_league_team_stats,
  load_league_careerlogs: league_careerlogs_actions.load_league_careerlogs
}

export default connect(map_state_to_props, map_dispatch_to_props)(TeamPage)
