import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Grid from '@mui/material/Grid'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'

import Icon from '@components/icon'
import Rank from '@components/rank'
import { Team } from '@core/teams'

export default function DashboardTeamSummaryFAAB({ teams, tid }) {
  const team = teams.find((t) => t.team_id === tid) || new Team()
  const rank = teams.findIndex((t) => t.team_id === tid) + 1

  const items = []
  for (const team of teams.valueSeq()) {
    items.push(
      <tr key={team.team_id}>
        <td>{team.name}</td>
        <td>${team.free_agent_acquisition_budget_balance}</td>
      </tr>
    )
  }

  return (
    <Accordion TransitionProps={{ unmountOnExit: true }}>
      <AccordionSummary expandIcon={<Icon name='arrow-down' />}>
        <Grid container>
          <Grid item xs={7}>
            Free Agency Budget
          </Grid>
          <Grid item xs={3}>
            ${team.free_agent_acquisition_budget_balance}
          </Grid>
          <Grid item xs={2}>
            <Rank rank={rank} size={teams.size} />
          </Grid>
        </Grid>
      </AccordionSummary>
      <AccordionDetails>
        <table>
          <tbody>{items}</tbody>
        </table>
      </AccordionDetails>
    </Accordion>
  )
}

DashboardTeamSummaryFAAB.propTypes = {
  tid: PropTypes.number,
  teams: ImmutablePropTypes.list
}
