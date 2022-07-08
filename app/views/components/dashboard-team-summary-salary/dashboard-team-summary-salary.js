import React from 'react'
import PropTypes from 'prop-types'
import Grid from '@mui/material/Grid'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

import Rank from '@components/rank'

export default class DashboardTeamSummarySalary extends React.Component {
  render = () => {
    const { team, teams, rank } = this.props

    const items = []
    for (const team of teams) {
      items.push(
        <tr key={team.uid}>
          <td>{team.name}</td>
          <td>${team.cap}</td>
        </tr>
      )
    }

    return (
      <Accordion TransitionProps={{ unmountOnExit: true }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Grid container>
            <Grid item xs={7}>
              Salary Space
            </Grid>
            <Grid item xs={3}>
              ${team.cap}
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
}

DashboardTeamSummarySalary.propTypes = {
  team: PropTypes.object,
  teams: PropTypes.array,
  rank: PropTypes.number
}
