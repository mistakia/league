import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getTeamsForCurrentLeague,
  getCurrentLeague,
  getRosterPositionalValueByTeamId
} from '@core/selectors'
import { constants } from '@libs-shared'

import DashboardLeaguePositionalValue from './dashboard-league-positional-value'

const league_has_starting_position = ({ pos, league }) => {
  switch (pos) {
    case 'QB':
      return Boolean(league.sqb || league.sqbrbwrte)
    case 'RB':
      return Boolean(
        league.srb || league.srbwr || league.srbwrte || league.sqbrbwrte
      )
    case 'WR':
      return Boolean(
        league.swr ||
          league.srbwr ||
          league.srbwrte ||
          league.swrte ||
          league.sqbrbwrte
      )
    case 'TE':
      return Boolean(
        league.ste || league.srbwrte || league.swrte || league.sqbrbwrte
      )
    case 'K':
      return Boolean(league.sk)
    case 'DST':
      return Boolean(league.sdst)
  }
}

const mapStateToProps = createSelector(
  getRosterPositionalValueByTeamId,
  getTeamsForCurrentLeague,
  getCurrentLeague,
  (summary, teams, league) => ({
    summary,
    teams,
    league_positions: constants.positions.filter((pos) =>
      league_has_starting_position({ pos, league })
    )
  })
)

export default connect(mapStateToProps)(DashboardLeaguePositionalValue)
