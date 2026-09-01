import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Grid from '@mui/material/Grid'

import { toPercent } from '#libs-shared'
import Accordion from '@components/accordion'
import Rank from '@components/rank'
import { Team } from '@core/teams'

export default function DashboardTeamSummaryDivisionOdds({ teams, tid }) {
  // A league with no Divisions has no division odds, and the forecast now says
  // so with a null rather than writing the bye flag into the column. Rendering
  // it anyway put an identical percentage on screen twice, since this panel
  // sits directly above Bye Odds.
  const has_division_odds = teams.some(
    (t) => t.division_odds !== null && t.division_odds !== undefined
  )
  if (!has_division_odds) return null

  const team = teams.find((t) => t.team_id === tid) || new Team()
  const rank = teams.findIndex((t) => t.team_id === tid) + 1
  const items = []
  for (const team of teams.valueSeq()) {
    items.push(
      <tr key={team.team_id}>
        <td>{team.name}</td>
        <td>{toPercent(team.division_odds)}</td>
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
              Division Odds
            </Grid>
            <Grid item xs={3}>
              {toPercent(team.division_odds)}
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

DashboardTeamSummaryDivisionOdds.propTypes = {
  teams: ImmutablePropTypes.list,
  tid: PropTypes.number
}
