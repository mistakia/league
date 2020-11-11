import React from 'react'
import Grid from '@material-ui/core/Grid'
import Accordion from '@material-ui/core/Accordion'
import AccordionDetails from '@material-ui/core/AccordionDetails'
import AccordionSummary from '@material-ui/core/AccordionSummary'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'

import Rank from '@components/rank'

export default class DashboardTeamSummaryRecord extends React.Component {
  render = () => {
    const { team, teams, rank } = this.props

    const leagueStandings = []
    const divStandings = []
    for (const t of teams.valueSeq()) {
      const item = (
        <tr key={t.uid}>
          <td>{t.name}</td>
          <td>{t.wins}-{t.losses}-{t.ties}</td>
          <td>{(t.pointsFor || 0).toFixed(1)}</td>
        </tr>
      )

      leagueStandings.push(item)
      if (t.div === team.div) divStandings.push(item)
    }

    return (
      <Accordion TransitionProps={{ unmountOnExit: true }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Grid container>
            <Grid item xs={8}>
              Record
            </Grid>
            <Grid item xs={4}>
              {team.wins}-{team.losses}-{team.ties} (<Rank rank={rank} size={teams.size} />)
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
            <tbody>
              {divStandings}
            </tbody>
          </table>
          <table>
            <thead>
              <tr>
                <td>Overall</td>
                <td>Rec</td>
                <td>PF</td>
              </tr>
            </thead>
            <tbody>
              {leagueStandings}
            </tbody>
          </table>
        </AccordionDetails>
      </Accordion>
    )
  }
}
