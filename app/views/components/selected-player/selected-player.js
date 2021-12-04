import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Button from '@material-ui/core/Button'
import Tabs from '@material-ui/core/Tabs'
import Tab from '@material-ui/core/Tab'
import SwipeableDrawer from '@material-ui/core/SwipeableDrawer'
import CloseIcon from '@material-ui/icons/Close'

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
import SelectedPlayerPractice from '@components/selected-player-practice'
import SelectedPlayerMatchup from '@components/selected-player-matchup'
import SelectedPlayerTransactions from '@components/selected-player-transactions'

import './selected-player.styl'

function TabPanel(props) {
  const { children, value, index, ...other } = props

  return (
    <div className='selected__player-body' hidden={value !== index} {...other}>
      {value === index && children}
    </div>
  )
}

TabPanel.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node
  ]),
  value: PropTypes.number,
  index: PropTypes.number
}

export default class SelectedPlayer extends React.Component {
  constructor(props) {
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
    const { player, isLoggedIn } = this.props
    const { value } = this.state

    const blacklist = ['0', 'ros']
    const projWks = player.projection
      .keySeq()
      .toArray()
      .filter((week) => !blacklist.includes(week)).length

    return (
      <SwipeableDrawer
        anchor='bottom'
        open={!!player.player}
        onClose={this.handleClose}
        classes={{
          paper: 'selected__player-paper'
        }}>
        <div className='selected__player-header'>
          <div className='selected__player-header-lead'>
            <div className='selected__player-first-name'>{player.fname}</div>
            <div className='selected__player-last-name'>{player.lname}</div>
            <div className='selected__player-meta'>
              <Position pos={player.pos} />
              <Team team={player.team} />
              <span>#{player.jersey}</span>
            </div>
          </div>
          <div className='selected__player-header-section'>
            {isLoggedIn && (
              <div className='selected__player-header-item'>
                <label>Manager</label>
                {player.tid ? <TeamName abbrv tid={player.tid} /> : '-'}
              </div>
            )}
            {isLoggedIn && player.value !== null && (
              <div className='selected__player-header-item'>
                <label>Salary</label>
                {`$${player.value}`}
              </div>
            )}
            <div className='selected__player-header-item'>
              <label>Status</label>
              {constants.status[player.status]
                ? player.status
                : player.gamestatus || 'Active'}
            </div>
          </div>
          {isLoggedIn && (
            <div className='selected__player-header-section'>
              <div className='selected__player-header-item'>
                <label>Starts</label>
                {player.getIn(['lineups', 'starts']) || '-'}
              </div>
              <div className='selected__player-header-item'>
                <label>Points+</label>
                {player.getIn(['lineups', 'sp'], 0).toFixed(1) || '-'}
              </div>
              <div className='selected__player-header-item'>
                <label>Bench+</label>
                {player.getIn(['lineups', 'bp'], 0).toFixed(1) || '-'}
              </div>
            </div>
          )}
          <div className='selected__player-header-section'>
            <div className='selected__player-header-item'>
              <label>Proj/G</label>
              {(player.getIn(['points', 'ros', 'total']) / projWks).toFixed(
                1
              ) || '-'}
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
              {constants.season.year - player.draft_year || 'Rookie'}
            </div>
          </div>
          <Button onClick={this.handleClose}>
            <CloseIcon />
          </Button>
        </div>
        <div className='selected__player-main'>
          <Tabs
            orientation={window.innerWidth < 600 ? 'horizontal' : 'vertical'}
            variant='scrollable'
            value={value}
            className='selected__player-menu'
            onChange={this.handleChange}>
            <Tab label='Projections' />
            <Tab label='Matchup' />
            <Tab label='Game Log' />
            <Tab label='Seasons' />
            <Tab label='Team Splits' />
            <Tab label='Efficiency' />
            <Tab label='Practice' />
            {isLoggedIn && <Tab label='Contribution' />}
            {isLoggedIn && <Tab label='Value' />}
            {isLoggedIn && <Tab label='Transactions' />}
          </Tabs>
          <TabPanel value={value} index={0}>
            <SelectedPlayerProjections />
          </TabPanel>
          <TabPanel value={value} index={1}>
            <SelectedPlayerMatchup />
          </TabPanel>
          <TabPanel value={value} index={2}>
            <SelectedPlayerGamelogs />
          </TabPanel>
          <TabPanel value={value} index={3}>
            <SelectedPlayerSeasonStats pos={player.pos} />
          </TabPanel>
          <TabPanel value={value} index={4}>
            <SelectedPlayerTeamStats />
            <SelectedPlayerTeamSituationSplits />
            <SelectedPlayerTeamPositionSplits />
          </TabPanel>
          <TabPanel value={value} index={5}>
            <SelectedPlayerEfficiencyStats />
          </TabPanel>
          <TabPanel value={value} index={6}>
            <SelectedPlayerPractice />
          </TabPanel>
          <TabPanel value={value} index={7}>
            <SelectedPlayerLineupImpact />
          </TabPanel>
          <TabPanel value={value} index={8}>
            <SelectedPlayerValue />
          </TabPanel>
          <TabPanel value={value} index={9}>
            <SelectedPlayerTransactions />
          </TabPanel>
        </div>
      </SwipeableDrawer>
    )
  }
}

SelectedPlayer.propTypes = {
  children: PropTypes.element,
  deselect: PropTypes.func,
  player: ImmutablePropTypes.record,
  isLoggedIn: PropTypes.bool
}
