import React from 'react'
import PropTypes from 'prop-types'
import Grid from '@material-ui/core/Grid'
import Accordion from '@material-ui/core/Accordion'
import AccordionDetails from '@material-ui/core/AccordionDetails'
import AccordionSummary from '@material-ui/core/AccordionSummary'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'

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
            <Grid item xs={8}>
              Salary Space
            </Grid>
            <Grid item xs={4}>
              ${team.cap} (<Rank rank={rank} size={teams.size} />)
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
