import React from 'react'
import PropTypes from 'prop-types'
import Grid from '@mui/material/Grid'

import Accordion from '@components/accordion'
import Rank from '@components/rank'
import { Team } from '@core/teams'

export default function DashboardTeamSummarySalary({ teams, tid }) {
  const team = teams.find((t) => t.team_id === tid) || new Team()
  const rank = teams.findIndex((t) => t.team_id === tid) + 1

  const items = []
  for (const team of teams) {
    items.push(
      <tr key={team.team_id}>
        <td>{team.name}</td>
        <td>${team.cap}</td>
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
              Salary Space
            </Grid>
            <Grid item xs={3}>
              {Boolean(team.cap) && `$${team.cap}`}
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

DashboardTeamSummarySalary.propTypes = {
  teams: PropTypes.array,
  tid: PropTypes.number
}
