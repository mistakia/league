import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Grid from '@mui/material/Grid'

import { toPercent } from '#libs-shared'
import Accordion from '@components/accordion'
import Rank from '@components/rank'
import { Team } from '@core/teams'

export default function DashboardTeamSummaryByeOdds({ teams, tid }) {
  const team = teams.find((t) => t.team_id === tid) || new Team()
  const rank = teams.findIndex((t) => t.team_id === tid) + 1

  const items = []
  for (const team of teams.valueSeq()) {
    items.push(
      <tr key={team.team_id}>
        <td>{team.name}</td>
        <td>{toPercent(team.bye_odds)}</td>
      </tr>
    )
  }

  return (
    <Accordion
      unmount_on_collapse
      summary={
        <>
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
        </>
      }
    >
      <table>
        <tbody>{items}</tbody>
      </table>
    </Accordion>
  )
}

DashboardTeamSummaryByeOdds.propTypes = {
  teams: ImmutablePropTypes.list,
  tid: PropTypes.number
}
