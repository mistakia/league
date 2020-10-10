import React from 'react'
import Container from '@material-ui/core/Container'
import Grid from '@material-ui/core/Grid'

import PageLayout from '@layouts/page'
import ScoreboardSelectWeek from '@components/scoreboard-select-week'
import ScoreboardScores from '@components/scoreboard-scores'
import ScoreboardTeam from '@components/scoreboard-team'
import ScoreboardOverTime from '@components/scoreboard-over-time'
import ScoreboardPlayByPlay from '@components/scoreboard-play-by-play'
import ScoreboardSlots from '@components/scoreboard-slots'

import './scoreboard.styl'

export default class ScoreboardPage extends React.Component {
  constructor (props) {
    super(props)

    this.state = {
      show: false
    }
  }

  handleClick = () => {
    this.setState({ show: !this.state.show })
  }

  render = () => {
    const { matchup } = this.props

    const body = (
      <Container maxWidth='lg'>
        <Grid container spacing={0}>
          <Grid item xs={12}>
            <div className='scoreboard__menu'>
              <ScoreboardSelectWeek />
            </div>
          </Grid>
          <Grid item xs={12}>
            <ScoreboardScores />
          </Grid>
          <Grid container item xs={12} spacing={0}>
            <Grid item xs={12} md={9}>
              <div className='scoreboard__main'>
                <ScoreboardTeam tid={matchup.aid} type='away' showBench={this.state.show} />
                <ScoreboardSlots />
                <ScoreboardTeam tid={matchup.hid} type='home' showBench={this.state.show} />
              </div>
              <div className='scoreboard__bench cursor' onClick={this.handleClick}>
                Show Bench
              </div>
            </Grid>
            <Grid item xs={12} md={3}>
              <ScoreboardPlayByPlay mid={matchup.uid} />
            </Grid>
          </Grid>
          <Grid container item xs={12} spacing={0}>
            <Grid item xs={12}>
              <ScoreboardOverTime mid={matchup.uid} />
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
