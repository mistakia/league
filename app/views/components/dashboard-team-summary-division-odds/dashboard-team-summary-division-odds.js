import React from 'react'
import Grid from '@material-ui/core/Grid'
import Accordion from '@material-ui/core/Accordion'
import AccordionDetails from '@material-ui/core/AccordionDetails'
import AccordionSummary from '@material-ui/core/AccordionSummary'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'

import { toPercent } from '@common'
import Rank from '@components/rank'

export default class DashboardTeamSummaryDivisionOdds extends React.Component {
  render = () => {
    const { team, teams, rank } = this.props

    const items = []
    for (const team of teams.valueSeq()) {
      items.push(
        <tr key={team.uid}>
          <td>{team.name}</td>
          <td>{toPercent(team.divisionOdds)}</td>
        </tr>
      )
    }

    return (
      <Accordion TransitionProps={{ unmountOnExit: true }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Grid container>
            <Grid item xs={8}>
              Division Odds
            </Grid>
            <Grid item xs={4}>
              {toPercent(team.divisionOdds)} (<Rank rank={rank} size={teams.size} />)
            </Grid>
          </Grid>
        </AccordionSummary>
        <AccordionDetails>
          <table>
            <tbody>
              {items}
            </tbody>
          </table>
        </AccordionDetails>
      </Accordion>
    )
  }
}
