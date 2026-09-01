import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Grid from '@mui/material/Grid'

import Accordion from '@components/accordion'
import Rank from '@components/rank'
import { nth } from '#libs-shared'
import { Team } from '@core/teams'

export default function DashboardTeamSummaryWaiverOrder({ teams, tid }) {
  const team = teams.find((t) => t.team_id === tid) || new Team()

  const items = []
  for (const team of teams.valueSeq()) {
    items.push(
      <tr key={team.team_id}>
        <td>{team.name}</td>
        <td>
          {team.waiver_order}
          {nth(team.waiver_order)}
        </td>
      </tr>
    )
  }

  return (
    <Accordion
      unmount_on_collapse
      summary={
        <>
          <Grid container>
            <Grid item xs={10}>
              Waiver Order
            </Grid>
            <Grid item xs={2}>
              <Rank rank={team.waiver_order} size={teams.size} />
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

DashboardTeamSummaryWaiverOrder.propTypes = {
  teams: ImmutablePropTypes.list,
  tid: PropTypes.number
}
