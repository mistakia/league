import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Grid from '@material-ui/core/Grid'
import Accordion from '@material-ui/core/Accordion'
import AccordionDetails from '@material-ui/core/AccordionDetails'
import AccordionSummary from '@material-ui/core/AccordionSummary'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'

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
