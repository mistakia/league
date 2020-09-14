import React from 'react'
import Container from '@material-ui/core/Container'
import Grid from '@material-ui/core/Grid'

import PageLayout from '@layouts/page'
import ScoreboardScores from '@components/scoreboard-scores'
import ScoreboardTeam from '@components/scoreboard-team'
import ScoreboardOverTime from '@components/scoreboard-over-time'
import ScoreboardPlayByPlay from '@components/scoreboard-play-by-play'
import ScoreboardSlots from '@components/scoreboard-slots'

import './scoreboard.styl'

export default class ScoreboardPage extends React.Component {
  componentDidMount = () => {
    this.props.load()
  }

  render = () => {
    const { matchup } = this.props

    const body = (
      <Container maxWidth='lg'>
        <Grid container spacing={0}>
          <Grid item xs={12}>
            <ScoreboardScores />
          </Grid>
          <Grid container item xs={12} spacing={0}>
            <Grid item xs={12} md={9}>
              <div className='scoreboard__main'>
                <ScoreboardTeam tid={matchup.aid} type='away' />
                <ScoreboardSlots />
                <ScoreboardTeam tid={matchup.hid} type='home' />
              </div>
            </Grid>
            <Grid item xs={12} md={3}>
              <div>
                <ScoreboardOverTime />
                <ScoreboardPlayByPlay mid={matchup.uid} />
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
