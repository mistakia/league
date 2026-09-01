import React from 'react'
import PropTypes from 'prop-types'
import Grid from '@mui/material/Grid'

import Accordion from '@components/accordion'

export default class DashboardTeamSummaryFranchiseTags extends React.Component {
  render = () => {
    const { league } = this.props

    const items = []
    items.push(
      <tr key='qb'>
        <td>QB</td>
        <td>${league.franchise_tag_salary_quarterback}</td>
      </tr>
    )
    items.push(
      <tr key='rb'>
        <td>RB</td>
        <td>${league.franchise_tag_salary_running_back}</td>
      </tr>
    )
    items.push(
      <tr key='wr'>
        <td>WR</td>
        <td>${league.franchise_tag_salary_wide_receiver}</td>
      </tr>
    )
    items.push(
      <tr key='te'>
        <td>TE</td>
        <td>${league.franchise_tag_salary_tight_end}</td>
      </tr>
    )

    return (
      <Accordion
        unmount_on_collapse
        summary={
          <>
            <Grid container>
              <Grid item xs={12}>
                Franchise Tag Salaries
              </Grid>
            </Grid>
          </>
        }
      >
        <table>
          <tbody>{items}</tbody>
        </table>
      </Accordion>
    )
  }
}

DashboardTeamSummaryFranchiseTags.propTypes = {
  league: PropTypes.object
}
