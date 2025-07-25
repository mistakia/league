import { List } from 'immutable'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_current_league } from '@core/selectors'

import LeagueTeamValueOverTime from './league-team-value-over-time'

const timestamp_1y_cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000

const map_state_to_props = createSelector(
  (state) => state.get('league_team_daily_values'),
  (state, props) => props.tid,
  get_current_league,
  (league_team_daily_values, tid, league) => {
    const league_total_due_amount = league.num_teams * league.season_due_amount
    const filtered_values = league_team_daily_values
      .get(tid, new List())
      .filter((item) => item.timestamp > timestamp_1y_cutoff)

    const series_data = []
    filtered_values.forEach((item) => {
      series_data.push([
        item.timestamp,
        item.ktc_share * league_total_due_amount
      ])
    })

    return {
      series_data
    }
  }
)

export default connect(map_state_to_props)(LeagueTeamValueOverTime)
