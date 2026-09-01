import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Grid from '@mui/material/Grid'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'

import Icon from '@components/icon'
import Rank from '@components/rank'
import { Team } from '@core/teams'

export default function DashboardTeamSummaryRecord({
  overall,
  standings,
  tid
}) {
  const team = standings.teams.find((t) => t.team_id === tid) || new Team()
  const rank = overall.findIndex((t) => t.team_id === tid) + 1

  const leagueStandings = []
  const divStandings = []
  for (const [index, t] of overall.entries()) {
    const item = (
      <tr key={t.team_id}>
        <td>{t.name}</td>
        <td style={{ minWidth: '58px' }}>
          {t.getIn(['stats', 'regular_season_wins'], 0)}-
          {t.getIn(['stats', 'regular_season_losses'], 0)}-
          {t.getIn(['stats', 'regular_season_ties'], 0)}
        </td>
        <td style={{ minWidth: '58px' }}>
          {t.getIn(['stats', 'points_for'], 0).toFixed(1)}
        </td>
      </tr>
    )

    leagueStandings.push(item)

    // Dividers come from the league's own playoff format, not from a fixed
    // 6/2 shape. There is no "Division Leaders" band any more -- divisions
    // decide bye eligibility, not a block of seeds.
    const seed = index + 1

    if (seed === standings.bye_count) {
      leagueStandings.push(
        <tr key='bye'>
          <td colSpan='3'>Bye Teams</td>
        </tr>
      )
    } else if (seed === standings.playoff_team_count) {
      leagueStandings.push(
        <tr key='wildcard'>
          <td colSpan='3'>Wildcard Teams</td>
        </tr>
      )
    }

    if (t.division === team.division) divStandings.push(item)
  }

  // With a single division the divisional table is a copy of the overall one.
  const has_divisions =
    standings.teams.groupBy((t) => t.get('division')).size > 1

  return (
    <Accordion TransitionProps={{ unmountOnExit: true }}>
      <AccordionSummary expandIcon={<Icon name='arrow-down' />}>
        <Grid container>
          <Grid item xs={7}>
            Record
          </Grid>
          <Grid item xs={3}>
            {team.getIn(['stats', 'regular_season_wins'], 0)}-
            {team.getIn(['stats', 'regular_season_losses'], 0)}-
            {team.getIn(['stats', 'regular_season_ties'], 0)}
          </Grid>
          <Grid item xs={2}>
            <Rank rank={rank} size={standings.teams.size} />
          </Grid>
        </Grid>
      </AccordionSummary>
      <AccordionDetails style={{ flexWrap: 'wrap' }}>
        {has_divisions && (
          <table>
            <thead>
              <tr>
                <td>Division</td>
                <td>Rec</td>
                <td>PF</td>
              </tr>
            </thead>
            <tbody>{divStandings}</tbody>
          </table>
        )}
        <table>
          <thead>
            <tr>
              <td>Overall</td>
              <td>Rec</td>
              <td>PF</td>
            </tr>
          </thead>
          <tbody>{leagueStandings}</tbody>
        </table>
      </AccordionDetails>
    </Accordion>
  )
}

DashboardTeamSummaryRecord.propTypes = {
  standings: PropTypes.object,
  overall: ImmutablePropTypes.list,
  tid: PropTypes.number
}
