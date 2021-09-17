import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Grid from '@material-ui/core/Grid'
import Accordion from '@material-ui/core/Accordion'
import AccordionDetails from '@material-ui/core/AccordionDetails'
import AccordionSummary from '@material-ui/core/AccordionSummary'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'

import Rank from '@components/rank'

export default class DashboardTeamSummaryRecord extends React.Component {
  render = () => {
    const { team, overall, standings, rank } = this.props

    const leagueStandings = []
    const divStandings = []
    for (const [index, t] of overall.entries()) {
      const item = (
        <tr key={t.uid}>
          <td>{t.name}</td>
          <td>
            {t.getIn(['stats', 'wins'], 0)}-{t.getIn(['stats', 'losses'], 0)}-
            {t.getIn(['stats', 'ties'], 0)}
          </td>
          <td>{t.getIn(['stats', 'pf'], 0).toFixed(1)}</td>
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
              {team.getIn(['stats', 'wins'], 0)}-
              {team.getIn(['stats', 'losses'], 0)}-
              {team.getIn(['stats', 'ties'], 0)}
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
}

DashboardTeamSummaryRecord.propTypes = {
  team: ImmutablePropTypes.record,
  standings: PropTypes.object,
  overall: ImmutablePropTypes.list,
  rank: PropTypes.number
}
