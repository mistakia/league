import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Grid from '@mui/material/Grid'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

import { toPercent } from '@common'
import Rank from '@components/rank'

export default class DashboardTeamSummaryByeOdds extends React.Component {
  render = () => {
    const { team, teams, rank } = this.props

    const items = []
    for (const team of teams.valueSeq()) {
      items.push(
        <tr key={team.uid}>
          <td>{team.name}</td>
          <td>{toPercent(team.bye_odds)}</td>
        </tr>
      )
    }

    return (
      <Accordion TransitionProps={{ unmountOnExit: true }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Grid container>
            <Grid item xs={7}>
              Bye Odds
            </Grid>
            <Grid item xs={3}>
              {toPercent(team.bye_odds)}
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

DashboardTeamSummaryByeOdds.propTypes = {
  team: ImmutablePropTypes.record,
  teams: ImmutablePropTypes.list,
  rank: PropTypes.number
}
