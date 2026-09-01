import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Grid from '@mui/material/Grid'

import { toPercent } from '#libs-shared'
import Accordion from '@components/accordion'
import Rank from '@components/rank'
import { Team } from '@core/teams'

export default function DashboardTeamSummaryPlayoffOdds({ teams, tid }) {
  const team = teams.find((t) => t.team_id === tid) || new Team()
  const rank = teams.findIndex((t) => t.team_id === tid) + 1

  const items = []
  for (const team of teams.valueSeq()) {
    items.push(
      <tr key={team.team_id}>
        <td>{team.name}</td>
        <td>{toPercent(team.playoff_odds)}</td>
      </tr>
    )
  }

  return (
    <Accordion
      unmount_on_collapse
      summary={
        <>
          <Grid container>
            <Grid item xs={7}>
              Playoff Odds
            </Grid>
            <Grid item xs={3}>
              {toPercent(team.playoff_odds)}
            </Grid>
            <Grid item xs={2}>
              <Rank rank={rank} size={teams.size} />
            </Grid>
          </Grid>
        </>
      }
    >
      <table>
        <tbody>{items}</tbody>
      </table>
    </Accordion>
  )
}

DashboardTeamSummaryPlayoffOdds.propTypes = {
  teams: ImmutablePropTypes.list,
  tid: PropTypes.number
}
