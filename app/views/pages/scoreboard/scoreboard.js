import React from 'react'
import Container from '@material-ui/core/Container'
import Grid from '@material-ui/core/Grid'

import PageLayout from '@layouts/page'
import ScoreboardScores from '@components/scoreboard-scores'
import ScoreboardTeam from '@components/scoreboard-team'
import ScoreboardOverTime from '@components/scoreboard-over-time'
import ScoreboardPlayByPlay from '@components/scoreboard-play-by-play'

import './scoreboard.styl'

export default class ScoreboardPage extends React.Component {
  componentDidMount = () => {

  }

  render = () => {
    const { matchup } = this.props

    const body = (
      <Container maxWidth='lg'>
        <Grid container spacing={1}>
          <Grid item xs={12}>
            <ScoreboardScores />
          </Grid>
          <Grid container item xs={12} spacing={1}>
            <Grid container item xs={12} md={9} spacing={0} classes={{ container: 'scoreboard__main' }}>
              <Grid item xs={6}>
                <ScoreboardTeam tid={matchup.aid} type='away' />
              </Grid>
              <Grid item xs={6}>
                <ScoreboardTeam tid={matchup.hid} type='home' />
              </Grid>
            </Grid>
            <Grid item xs={12} md={3}>
              <div>
                <ScoreboardOverTime />
                <ScoreboardPlayByPlay />
              </div>
            </Grid>
          </Grid>
        </Grid>
      </Container>
    )

    return (
      <PageLayout body={body} scroll />
    )
  }
}
