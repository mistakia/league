import React from 'react'
import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import Paper from '@material-ui/core/Paper'
import Draggable from 'react-draggable'
import Tabs from '@material-ui/core/Tabs'
import Tab from '@material-ui/core/Tab'

import { constants } from '@common'
import Team from '@components/team'
import TeamName from '@components/team-name'
import Position from '@components/position'
import PlayerAge from '@components/player-age'
import SelectedPlayerSeasonStats from '@components/selected-player-season-stats'
import SelectedPlayerProjections from '@components/selected-player-projections'
import SelectedPlayerTeamStats from '@components/selected-player-team-stats'
import SelectedPlayerTeamSituationSplits from '@components/selected-player-team-situation-splits'
import SelectedPlayerTeamPositionSplits from '@components/selected-player-team-position-splits'
import SelectedPlayerEfficiencyStats from '@components/selected-player-efficiency-stats'
import SelectedPlayerLineupImpact from '@components/selected-player-lineup-impact'
import SelectedPlayerValue from '@components/selected-player-value'
import SelectedPlayerGamelogs from '@components/selected-player-gamelogs'

import './selected-player.styl'

function PaperComponent (props) {
  return (
    <Draggable handle='#draggable-dialog-title' cancel={'[class*="MuiDialogContent-root"]'}>
      <Paper {...props} />
    </Draggable>
  )
}

function TabPanel (props) {
  const { children, value, index, ...other } = props

  return (
    <div className='selected__player-body' hidden={value !== index} {...other}>
      {(value === index) && children}
    </div>
  )
}

export default class SelectedPlayer extends React.Component {
  constructor (props) {
    super(props)

    this.state = {
      value: 0
    }
  }

  handleChange = (event, value) => {
    this.setState({ value })
  }

  handleClose = () => {
    this.props.deselect()
  }

  render = () => {
    const { player } = this.props
    const { value } = this.state

    if (!player.player) return null

    return (
      <Dialog
        open={!!player.player}
        maxWidth='xl'
        onClose={this.handleClose}
        classes={{
          paper: 'selected__player-paper'
        }}
        PaperComponent={PaperComponent}
        aria-labelledby='draggable-dialog-title'
      >
        <div className='selected__player-header' id='draggable-dialog-title'>
          <div className='selected__player-header-lead'>
            <div className='selected__player-first-name'>{player.fname}</div>
            <div className='selected__player-last-name'>{player.lname}</div>
            <div className='selected__player-meta'>
              <Position pos={player.pos1} />
              <Team team={player.team} />
              <span>#{player.jersey}</span>
            </div>
          </div>
          <div className='selected__player-header-section'>
            <div className='selected__player-header-item'>
              <label>Manager</label>
              {player.tid ? <TeamName abbrv tid={player.tid} /> : '-'}
            </div>
            {(player.value !== null) &&
              <div className='selected__player-header-item'>
                <label>Salary</label>
                {`$${player.value}`}
              </div>}

            <div className='selected__player-header-item'>
              <label>Status</label>
              {constants.status[player.status] ? player.status : (player.gamestatus || 'Active')}
            </div>
          </div>
          <div className='selected__player-header-section'>
            <div className='selected__player-header-item'>
              <label>Starts</label>
              {player.getIn(['lineups', 'starts']) || '-'}
            </div>
            <div className='selected__player-header-item'>
              <label>Points+</label>
              {(player.getIn(['lineups', 'sp'], 0)).toFixed(1) || '-'}
            </div>
            <div className='selected__player-header-item'>
              <label>Bench+</label>
              {(player.getIn(['lineups', 'bp'], 0)).toFixed(1) || '-'}
            </div>
          </div>
          <div className='selected__player-header-section'>
            <div className='selected__player-header-item'>
              <label>Proj/G</label>
              {(player.getIn(['points', 'ros', 'total']) / player.projWks).toFixed(1) || '-'}
            </div>
            <div className='selected__player-header-item'>
              <label>VOBA</label>
              {player.getIn(['vorp', 'ros', 'available'], 0).toFixed(1)}
            </div>
            <div className='selected__player-header-item'>
              <label>VOWS</label>
              {player.getIn(['vorp', 'ros', 'starter'], 0).toFixed(1)}
            </div>
          </div>
          <div className='selected__player-header-section'>
            <div className='selected__player-header-item'>
              <label>Draft</label>
              {player.dpos ? `#${player.dpos}` : 'UDFA'}
            </div>
            <div className='selected__player-header-item'>
              <label>Age</label>
              <PlayerAge date={player.dob} />
            </div>
            <div className='selected__player-header-item'>
              <label>Exp.</label>
              {(constants.season.year - player.draft_year) || 'Rookie'}
            </div>
          </div>
          <Button onClick={this.handleClose}>
            Close
          </Button>
        </div>
        <div className='selected__player-main'>
          <Tabs
            orientation='vertical'
            variant='scrollable'
            value={value}
            className='selected__player-menu'
            onChange={this.handleChange}
          >
            <Tab label='Impact' />
            <Tab label='Value' />
            <Tab label='Matchup' />
            <Tab label='Projections' />
            <Tab label='Game Log' />
            <Tab label='Stats' />
            <Tab label='Team Splits' />
            <Tab label='Oppurtunity' />
            <Tab label='Efficiency' />
            <Tab label='News' />
          </Tabs>
          <TabPanel value={value} index={0}>
            <SelectedPlayerLineupImpact />
          </TabPanel>
          <TabPanel value={value} index={1}>
            <SelectedPlayerValue />
          </TabPanel>
          <TabPanel value={value} index={2}>
            Coming soon
          </TabPanel>
          <TabPanel value={value} index={3}>
            <SelectedPlayerProjections />
          </TabPanel>
          <TabPanel value={value} index={4}>
            <SelectedPlayerGamelogs />
          </TabPanel>
          <TabPanel value={value} index={5}>
            <SelectedPlayerSeasonStats pos={player.pos1} />
          </TabPanel>
          <TabPanel value={value} index={6}>
            <SelectedPlayerTeamStats />
            <SelectedPlayerTeamSituationSplits />
            <SelectedPlayerTeamPositionSplits />
          </TabPanel>
          <TabPanel value={value} index={7}>
            Coming Soon
          </TabPanel>
          <TabPanel value={value} index={8}>
            <SelectedPlayerEfficiencyStats />
          </TabPanel>
          <TabPanel value={value} index={9}>
            Coming soon
          </TabPanel>
        </div>
      </Dialog>
    )
  }
}
