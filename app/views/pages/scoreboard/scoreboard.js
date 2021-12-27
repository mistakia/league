import React from 'react'
import Container from '@material-ui/core/Container'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Grid from '@material-ui/core/Grid'

import PageLayout from '@layouts/page'
import ScoreboardSelectWeek from '@components/scoreboard-select-week'
import ScoreboardScores from '@components/scoreboard-scores'
import ScoreboardTeam from '@components/scoreboard-team'
import ScoreboardOverTime from '@components/scoreboard-over-time'
import ScoreboardPlayByPlay from '@components/scoreboard-play-by-play'
import ScoreboardSlots from '@components/scoreboard-slots'
import ScoreboardTeams from '@components/scoreboard-teams'
import { constants } from '@common'

import './scoreboard.styl'

export default class ScoreboardPage extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      tid: props.matchup.getIn(['tids', '0']) || props.matchup.hid,
      show: false
    }
  }

  componentDidUpdate = (prevProps) => {
    if (prevProps.matchup.uid !== this.props.matchup.uid) {
      this.setState({
        tid: this.props.matchup.getIn(['tids', '0']) || this.props.matchup.hid
      })
    }
  }

  handleSelect = (tid) => {
    this.setState({ tid })
  }

  handleBenchToggle = () => {
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
            {matchup.type === constants.matchups.H2H && <ScoreboardScores />}
          </Grid>
          <Grid container item xs={12} spacing={0}>
            <Grid item xs={12} md={9}>
              {matchup.type === constants.matchups.TOURNAMENT && (
                <ScoreboardTeams
                  onClick={this.handleSelect}
                  selected={this.state.tid}
                />
              )}
              <div className='scoreboard__main'>
                {matchup.type === constants.matchups.H2H && (
                  <ScoreboardTeam
                    tid={matchup.aid}
                    type='away'
                    showBench={this.state.show}
                  />
                )}
                <ScoreboardSlots />
                <ScoreboardTeam
                  tid={this.state.tid}
                  type='home'
                  showBench={this.state.show}
                />
              </div>
              <div
                className='scoreboard__bench cursor'
                onClick={this.handleBenchToggle}>
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

    return <PageLayout body={body} scroll />
  }
}

ScoreboardPage.propTypes = {
  matchup: ImmutablePropTypes.record
}
