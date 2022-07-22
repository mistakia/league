import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Button from '@mui/material/Button'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'
import CloseIcon from '@mui/icons-material/Close'
import { Map } from 'immutable'

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
import PlayerWatchlistAction from '@components/player-watchlist-action'

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

    const projectionView = 0
    const transactionsView = 9
    this.state = {
      value: constants.season.isRegularSeason
        ? projectionView
        : transactionsView
    }
  }

  handleChange = (event, value) => {
    this.setState({ value })
  }

  handleOpen = () => {
    // required function
  }

  handleClose = () => {
    this.props.deselect()
  }

  render = () => {
    const { playerMap, isLoggedIn } = this.props
    const { value } = this.state

    const blacklist = ['0', 'ros']
    const projWks = playerMap
      .get('projection', new Map())
      .keySeq()
      .toArray()
      .filter((week) => !blacklist.includes(week)).length

    const pos = playerMap.get('pos')
    const pid = playerMap.get('pid')
    const tid = playerMap.get('tid', false)
    const playerStatus = playerMap.get('status')
    const draftNum = playerMap.get('dpos')
    const draftYear = playerMap.get('start')
    const playerValue = playerMap.get('value')
    const rosPoints = playerMap.getIn(['points', 'ros', 'total'], 0)

    return (
      <SwipeableDrawer
        anchor='bottom'
        onOpen={this.handleOpen}
        open={Boolean(pid)}
        onClose={this.handleClose}
        classes={{
          paper: 'selected__player-paper'
        }}
      >
        <div className='selected__player-header'>
          <div className='selected__player-header-lead'>
            <div className='selected__player-first-name'>
              {playerMap.get('fname')}
            </div>
            <div className='selected__player-last-name'>
              {playerMap.get('lname')}
            </div>
            <div className='selected__player-meta'>
              <Position pos={pos} />
              <Team team={playerMap.get('team')} />
              <span>#{playerMap.get('jnum', '-')}</span>
            </div>
          </div>
          <PlayerWatchlistAction pid={pid} />
          <div className='selected__player-header-secondary'>
            <div className='selected__player-header-section'>
              {isLoggedIn && (
                <div className='selected__player-header-item'>
                  <label>Manager</label>
                  {tid ? <TeamName abbrv tid={tid} /> : '-'}
                </div>
              )}
              {isLoggedIn && (
                <div className='selected__player-header-item'>
                  <label>Salary</label>
                  {playerValue ? `$${playerValue}` : '-'}
                </div>
              )}
              <div className='selected__player-header-item'>
                <label>Status</label>
                {constants.status[playerStatus]
                  ? playerStatus
                  : playerMap.get('gamestatus') || 'Active'}
              </div>
            </div>
            {isLoggedIn && (
              <div className='selected__player-header-section'>
                <div className='selected__player-header-item'>
                  <label>Starts</label>
                  {playerMap.getIn(['lineups', 'starts'], '-')}
                </div>
                <div className='selected__player-header-item'>
                  <label>Points+</label>
                  {playerMap.getIn(['lineups', 'sp'], 0).toFixed(1)}
                </div>
                <div className='selected__player-header-item'>
                  <label>Bench+</label>
                  {playerMap.getIn(['lineups', 'bp'], 0).toFixed(1)}
                </div>
              </div>
            )}
            <div className='selected__player-header-section'>
              <div className='selected__player-header-item'>
                <label>Proj/G</label>
                {rosPoints && projWks ? (rosPoints / projWks).toFixed(1) : '-'}
              </div>
              <div className='selected__player-header-item'>
                <label>VOBA</label>
                {playerMap.getIn(['vorp', 'ros', 'available'], 0).toFixed(1)}
              </div>
              <div className='selected__player-header-item'>
                <label>VOWS</label>
                {playerMap.getIn(['vorp', 'ros', 'starter'], 0).toFixed(1)}
              </div>
            </div>
            <div className='selected__player-header-section'>
              <div className='selected__player-header-item'>
                <label>Draft</label>
                {draftNum ? `#${draftNum}` : 'UDFA'}
              </div>
              <div className='selected__player-header-item'>
                <label>Age</label>
                <PlayerAge date={playerMap.get('dob')} />
              </div>
              <div className='selected__player-header-item'>
                <label>Exp.</label>
                {constants.season.year - draftYear || 'Rookie'}
              </div>
            </div>
          </div>
          <Button className='selected__player-close' onClick={this.handleClose}>
            <CloseIcon />
          </Button>
        </div>
        <div className='selected__player-main'>
          <Tabs
            orientation={window.innerWidth < 600 ? 'horizontal' : 'vertical'}
            variant='scrollable'
            indicatorColor='primary'
            textColor='inherit'
            value={value}
            className='selected__player-menu'
            onChange={this.handleChange}
          >
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
            <SelectedPlayerSeasonStats pos={pos} />
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
  playerMap: ImmutablePropTypes.map,
  isLoggedIn: PropTypes.bool
}
