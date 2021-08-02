import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Grid from '@material-ui/core/Grid'
import Accordion from '@material-ui/core/Accordion'
import AccordionDetails from '@material-ui/core/AccordionDetails'
import AccordionSummary from '@material-ui/core/AccordionSummary'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'

import Rank from '@components/rank'
import { nth } from '@common'

export default class DashboardTeamSummaryWaiverOrder extends React.Component {
  render = () => {
    const { team, teams } = this.props

    const items = []
    for (const team of teams.valueSeq()) {
      items.push(
        <tr key={team.uid}>
          <td>{team.name}</td>
          <td>
            {team.wo}
            {nth(team.wo)}
          </td>
        </tr>
      )
    }

    return (
      <Accordion TransitionProps={{ unmountOnExit: true }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Grid container>
            <Grid item xs={8}>
              Waiver Order
            </Grid>
            <Grid item xs={4}>
              <Rank rank={team.wo} size={teams.size} />
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

DashboardTeamSummaryWaiverOrder.propTypes = {
  team: ImmutablePropTypes.record,
  teams: ImmutablePropTypes.list
}
