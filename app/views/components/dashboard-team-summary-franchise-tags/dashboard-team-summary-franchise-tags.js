import React from 'react'
import PropTypes from 'prop-types'
import Grid from '@material-ui/core/Grid'
import Accordion from '@material-ui/core/Accordion'
import AccordionDetails from '@material-ui/core/AccordionDetails'
import AccordionSummary from '@material-ui/core/AccordionSummary'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'

export default class DashboardTeamSummaryFranchiseTags extends React.Component {
  render = () => {
    const { league } = this.props

    const items = []
    items.push(
      <tr key='qb'>
        <td>QB</td>
        <td>${league.fqb}</td>
      </tr>
    )
    items.push(
      <tr key='rb'>
        <td>RB</td>
        <td>${league.frb}</td>
      </tr>
    )
    items.push(
      <tr key='wr'>
        <td>WR</td>
        <td>${league.fwr}</td>
      </tr>
    )
    items.push(
      <tr key='te'>
        <td>TE</td>
        <td>${league.fte}</td>
      </tr>
    )

    return (
      <Accordion TransitionProps={{ unmountOnExit: true }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Grid container>
            <Grid item xs={12}>
              Franchise Tag Salaries
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

DashboardTeamSummaryFranchiseTags.propTypes = {
  league: PropTypes.object
}
