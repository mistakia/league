import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Grid from '@mui/material/Grid'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

import Rank from '@components/rank'
import { constants } from '@libs-shared'
import { Team } from '@core/teams'

export default function DashboardTeamSummaryRecord({
  overall,
  standings,
  tid
}) {
  const team = standings.teams.find((t) => t.uid === tid) || new Team()
  const rank = overall.findIndex((t) => t.uid === tid) + 1
  const { year } = constants

  const leagueStandings = []
  const divStandings = []
  for (const [index, t] of overall.entries()) {
    const item = (
      <tr key={t.uid}>
        <td>{t.name}</td>
        <td style={{ minWidth: '58px' }}>
          {t.getIn(['stats', year, 'wins'], 0)}-
          {t.getIn(['stats', year, 'losses'], 0)}-
          {t.getIn(['stats', year, 'ties'], 0)}
        </td>
        <td style={{ minWidth: '58px' }}>
          {t.getIn(['stats', year, 'pf'], 0).toFixed(1)}
        </td>
      </tr>
    )

    leagueStandings.push(item)

    if (index === 1) {
      leagueStandings.push(
        <tr key='bye'>
          <td colSpan='3'>Bye Teams</td>
        </tr>
      )
    } else if (index === 3) {
      leagueStandings.push(
        <tr key='division'>
          <td colSpan='3'>Division Leaders</td>
        </tr>
      )
    } else if (index === 5) {
      leagueStandings.push(
        <tr key='wildcard'>
          <td colSpan='3'>Wildcard Teams</td>
        </tr>
      )
    }

    if (t.div === team.div) divStandings.push(item)
  }

  return (
    <Accordion TransitionProps={{ unmountOnExit: true }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Grid container>
          <Grid item xs={7}>
            Record
          </Grid>
          <Grid item xs={3}>
            {team.getIn(['stats', year, 'wins'], 0)}-
            {team.getIn(['stats', year, 'losses'], 0)}-
            {team.getIn(['stats', year, 'ties'], 0)}
          </Grid>
          <Grid item xs={2}>
            <Rank rank={rank} size={standings.teams.size} />
          </Grid>
        </Grid>
      </AccordionSummary>
      <AccordionDetails style={{ flexWrap: 'wrap' }}>
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
