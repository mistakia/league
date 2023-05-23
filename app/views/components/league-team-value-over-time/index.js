import { List } from 'immutable'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/selectors'

import LeagueTeamValueOverTime from './league-team-value-over-time'

const timestamp_1y_cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000

const mapStateToProps = createSelector(
  (state) => state.get('league_team_daily_values'),
  (state, props) => props.tid,
  getCurrentLeague,
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

export default connect(mapStateToProps)(LeagueTeamValueOverTime)
