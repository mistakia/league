import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Button from '@mui/material/Button'
import Tabs from '@mui/base/TabsUnstyled'
import Tab from '@mui/base/TabUnstyled'
import TabPanel from '@mui/base/TabPanelUnstyled'
import TabsList from '@mui/base/TabsListUnstyled'
import Drawer from '@mui/material/Drawer'
import CloseIcon from '@mui/icons-material/Close'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import IconButton from '@mui/material/IconButton'
import { Map } from 'immutable'

import PlayerHeadshot from '@components/player-headshot'
import { constants } from '@common'
import NFLTeam from '@components/nfl-team'
import TeamName from '@components/team-name'
import Position from '@components/position'
import PlayerAge from '@components/player-age'
import SelectedPlayerSeasonStats from '@components/selected-player-season-stats'
import SelectedPlayerProjections from '@components/selected-player-projections'
/* import SelectedPlayerTeamStats from '@components/selected-player-team-stats'
 * import SelectedPlayerTeamSituationSplits from '@components/selected-player-team-situation-splits'
 * import SelectedPlayerTeamPositionSplits from '@components/selected-player-team-position-splits'
 * import SelectedPlayerEfficiencyStats from '@components/selected-player-efficiency-stats' */
import SelectedPlayerLineupImpact from '@components/selected-player-lineup-impact'
import SelectedPlayerValue from '@components/selected-player-value'
import SelectedPlayerGamelogs from '@components/selected-player-gamelogs'
import SelectedPlayerPractice from '@components/selected-player-practice'
// import SelectedPlayerMatchup from '@components/selected-player-matchup'
import SelectedPlayerTransactions from '@components/selected-player-transactions'
import PlayerWatchlistAction from '@components/player-watchlist-action'
import PlayerContextMenu from '@components/player-context-menu'

import './selected-player.styl'

const getHeadshotWidth = () => {
  if (window.innerWidth > 990) {
    return 200
  } else if (window.innerWidth < 750) {
    return 120
  } else {
    return 178
  }
}

const showCollapse = () => window.innerWidth < 750

export default class SelectedPlayer extends React.Component {
  constructor(props) {
    super(props)

    const projectionView = 0
    const transactionsView = 6
    const gamelogsView = 1
    this.state = {
      value: props.isLoggedIn
        ? constants.isRegularSeason
          ? projectionView
          : transactionsView
        : gamelogsView,
      headshot_width: getHeadshotWidth(),
      show_collapse: showCollapse(),
      collapsed: showCollapse()
    }
  }

  update = () => {
    this.setState({
      headshot_width: getHeadshotWidth(),
      show_collapse: showCollapse(),
      collapsed: showCollapse()
    })
  }

  componentDidMount = () => {
    window.addEventListener('resize', this.update)
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.update)
  }

  handleChange = (event, value) => {
    this.setState({ value })
  }

  handleToggleExpand = (event) => {
    this.setState({ collapsed: !this.state.collapsed })
  }

  handleClose = () => {
    this.props.deselect()
  }

  componentDidUpdate() {
    const element = document.querySelector('.TabUnstyled-root.Mui-selected')
    if (element) element.scrollIntoView({ behavior: 'smooth' })
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
      <Drawer
        anchor='bottom'
        open={Boolean(pid)}
        onClose={this.handleClose}
        classes={{
          paper: 'selected__player-paper'
        }}
      >
        <div className='selected__player-header'>
          <div className='selected__player-headshot'>
            <PlayerHeadshot
              playerMap={playerMap}
              width={this.state.headshot_width}
              square={window.innerWidth < 900}
            />
          </div>
          <div className='selected__player-header-lead'>
            <div className='selected__player-first-name'>
              {playerMap.get('fname')}
            </div>
            <div className='selected__player-last-name'>
              {playerMap.get('lname')}
            </div>
            <div className='selected__player-meta'>
              <Position pos={pos} />
              <NFLTeam team={playerMap.get('team')} />
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
              <div className='selected__player-header-item'>
                <label>Age</label>
                <PlayerAge date={playerMap.get('dob')} />
              </div>
              {isLoggedIn &&
                (this.state.show_collapse ? !this.state.collapsed : true) && (
                  <>
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
                  </>
                )}
              {(this.state.show_collapse ? !this.state.collapsed : true) && (
                <>
                  <div className='selected__player-header-item'>
                    <label>Proj/G</label>
                    {rosPoints && projWks
                      ? (rosPoints / projWks).toFixed(1)
                      : '-'}
                  </div>
                  <div className='selected__player-header-item'>
                    <label>VOBA</label>
                    {playerMap
                      .getIn(['vorp', 'ros', 'available'], 0)
                      .toFixed(1)}
                  </div>
                  <div className='selected__player-header-item'>
                    <label>VOWS</label>
                    {playerMap.getIn(['vorp', 'ros', 'starter'], 0).toFixed(1)}
                  </div>
                  <div className='selected__player-header-item'>
                    <label>Draft</label>
                    {draftNum ? `#${draftNum}` : 'UDFA'}
                  </div>
                  <div className='selected__player-header-item'>
                    <label>Exp.</label>
                    {constants.year - draftYear || 'Rookie'}
                  </div>
                </>
              )}
              {this.state.show_collapse && (
                <IconButton onClick={this.handleToggleExpand}>
                  {this.state.collapsed ? (
                    <ExpandMoreIcon />
                  ) : (
                    <ExpandLessIcon />
                  )}
                </IconButton>
              )}
              <PlayerContextMenu pid={pid} hideDisabled buttonGroup />
            </div>
          </div>
          <Button className='selected__player-close' onClick={this.handleClose}>
            <CloseIcon />
          </Button>
        </div>
        <div className='selected__player-main'>
          <Tabs
            orientation='horizontal'
            variant='scrollable'
            value={value}
            className='selected__player-menu'
            onChange={this.handleChange}
            defaultValue={0}
          >
            <TabsList>
              <Tab>Projections</Tab>
              {/* <Tab>Matchup</Tab> */}
              <Tab>Game Log</Tab>
              <Tab>Seasons</Tab>
              {/* <Tab>Team Splits</Tab> */}
              {/* <Tab>Efficiency</Tab> */}
              <Tab>Practice</Tab>
              {isLoggedIn && <Tab>Contribution</Tab>}
              {isLoggedIn && <Tab>Value</Tab>}
              {isLoggedIn && <Tab>Transactions</Tab>}
            </TabsList>
            <TabPanel value={0}>
              <SelectedPlayerProjections />
            </TabPanel>
            {/* <TabPanel value={1}>
                <SelectedPlayerMatchup />
                </TabPanel> */}
            <TabPanel value={1}>
              <SelectedPlayerGamelogs />
            </TabPanel>
            <TabPanel value={2}>
              <SelectedPlayerSeasonStats pos={pos} />
            </TabPanel>
            {/* <TabPanel value={4}>
                <SelectedPlayerTeamStats />
                <SelectedPlayerTeamSituationSplits />
                <SelectedPlayerTeamPositionSplits />
                </TabPanel> */}
            {/* <TabPanel value={5}>
                <SelectedPlayerEfficiencyStats />
                </TabPanel> */}
            <TabPanel value={3}>
              <SelectedPlayerPractice />
            </TabPanel>
            <TabPanel value={4}>
              <SelectedPlayerLineupImpact />
            </TabPanel>
            <TabPanel value={5}>
              <SelectedPlayerValue />
            </TabPanel>
            <TabPanel value={6}>
              <SelectedPlayerTransactions />
            </TabPanel>
          </Tabs>
        </div>
      </Drawer>
    )
  }
}

SelectedPlayer.propTypes = {
  children: PropTypes.element,
  deselect: PropTypes.func,
  playerMap: ImmutablePropTypes.map,
  isLoggedIn: PropTypes.bool
}
