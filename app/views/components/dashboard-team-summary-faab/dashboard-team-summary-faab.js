import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Grid from '@mui/material/Grid'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

import Rank from '@components/rank'
import { Team } from '@core/teams'

export default function DashboardTeamSummaryFAAB({ teams, tid }) {
  const team = teams.find((t) => t.uid === tid) || new Team()
  const rank = teams.findIndex((t) => t.uid === tid) + 1

  const items = []
  for (const team of teams.valueSeq()) {
    items.push(
      <tr key={team.uid}>
        <td>{team.name}</td>
        <td>${team.faab}</td>
      </tr>
    )
  }

  return (
    <Accordion TransitionProps={{ unmountOnExit: true }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Grid container>
          <Grid item xs={7}>
            Free Agency Budget
          </Grid>
          <Grid item xs={3}>
            ${team.faab}
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
