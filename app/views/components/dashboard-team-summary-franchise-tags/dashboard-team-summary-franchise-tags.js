import React from 'react'
import PropTypes from 'prop-types'
import Grid from '@mui/material/Grid'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

export default class DashboardTeamSummaryFranchiseTags extends React.Component {
  render = () => {
    const { league } = this.props

    const items = []
    items.push(
      <tr key='qb'>
        <td>QB</td>
        <td>${league.franchise_tag_salary_qb}</td>
      </tr>
    )
    items.push(
      <tr key='rb'>
        <td>RB</td>
        <td>${league.franchise_tag_salary_rb}</td>
      </tr>
    )
    items.push(
      <tr key='wr'>
        <td>WR</td>
        <td>${league.franchise_tag_salary_wr}</td>
      </tr>
    )
    items.push(
      <tr key='te'>
        <td>TE</td>
        <td>${league.franchise_tag_salary_te}</td>
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
