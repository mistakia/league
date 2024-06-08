import React, { useState, useEffect } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Button from '@mui/material/Button'
import { Tabs } from '@mui/base/Tabs'
import { Tab } from '@mui/base/Tab'
import { TabPanel } from '@mui/base/TabPanel'
import { TabsList } from '@mui/base/TabsList'
import Drawer from '@mui/material/Drawer'
import CloseIcon from '@mui/icons-material/Close'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import IconButton from '@mui/material/IconButton'
import { Map } from 'immutable'

import PlayerName from '@components/player-name'
import { constants, nth } from '@libs-shared'
import TeamName from '@components/team-name'
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
import SelectedPlayerSchedule from '@components/selected-player-schedule'
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

export default function SelectedPlayer({
  playerMap,
  is_logged_in,
  market_salary_adjusted,
  is_before_end_of_free_agent_period,
  deselect,
  loadAllPlayers
}) {
  const projectionView = 0
  const transactionsView = 6
  const gamelogsView = 1
  const [value, setValue] = useState(
    is_logged_in
      ? constants.isRegularSeason
        ? projectionView
        : transactionsView
      : gamelogsView
  )
  const [headshot_width, setHeadshotWidth] = useState(getHeadshotWidth())
  const [show_collapse, setShowCollapse] = useState(showCollapse())
  const [collapsed, setCollapsed] = useState(showCollapse())
  const [is_headshot_square, set_is_headshot_square] = useState(
    window.innerWidth < 950
  )

  const update = () => {
    setHeadshotWidth(getHeadshotWidth())
    setShowCollapse(showCollapse())
    setCollapsed(showCollapse())
    set_is_headshot_square(window.innerWidth < 950)
  }

  useEffect(() => {
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
    }
  }, [])

  useEffect(() => {
    if (is_before_end_of_free_agent_period) {
      loadAllPlayers()
    }
  }, [is_before_end_of_free_agent_period, loadAllPlayers])

  const handleChange = (event, value) => setValue(value)
  const handleToggleExpand = (event) => setCollapsed(!collapsed)
  const handleClose = () => deselect()

  useEffect(() => {
    const element = document.querySelector('.base-Tab-root.Mui-selected')
    if (element) element.scrollIntoView({ behavior: 'smooth' })
  }, [value])

  const blacklist = ['0', 'ros']
  const projWks = playerMap
    .get('projection', new Map())
    .keySeq()
    .toArray()
    .filter((week) => !blacklist.includes(week)).length

  const pos = playerMap.get('pos')
  const pid = playerMap.get('pid')
  const tid = playerMap.get('tid', false)
  const player_nfl_status = playerMap.get('nfl_status')
  const draftNum = playerMap.get('dpos')
  const draftYear = playerMap.get('start')
  const draftRound = playerMap.get('round')
  const playerValue = playerMap.get('value')
  const rosPoints = playerMap.getIn(['points', 'ros', 'total'], 0)

  const has_pfr_link = Boolean(
    playerMap.get('lname') && playerMap.get('pfr_id')
  )
  const open_pfr_link = () => {
    window.open(
      `https://www.pro-football-reference.com/players/${playerMap.get('lname')[0].toUpperCase()}/${playerMap.get('pfr_id')}.htm`,
      '_blank'
    )
  }

  const has_rotowire_link = Boolean(playerMap.get('rotowire_id'))
  const open_rotowire_link = () => {
    window.open(
      `https://rotowire.com/football/player.php?id=${playerMap.get('rotowire_id')}`,
      '_blank'
    )
  }

  const has_fantasy_data_link = Boolean(playerMap.get('fantasy_data_id'))
  const open_fantasy_data_link = () => {
    window.open(
      `https://fantasydata.com/nfl/player-fantasy/${playerMap.get('fantasy_data_id')}`,
      '_blank'
    )
  }

  const has_espn_link = Boolean(playerMap.get('espn_id'))
  const open_espn_link = () => {
    window.open(
      `https://www.espn.com/nfl/player/_/id/${playerMap.get('espn_id')}`,
      '_blank'
    )
  }

  const has_yahoo_link = Boolean(playerMap.get('yahoo_id'))
  const open_yahoo_link = () => {
    window.open(
      `https://sports.yahoo.com/nfl/players/${playerMap.get('yahoo_id')}`,
      '_blank'
    )
  }

  const has_external_link =
    has_pfr_link ||
    has_rotowire_link ||
    has_fantasy_data_link ||
    has_espn_link ||
    has_yahoo_link

  return (
    <Drawer
      anchor='bottom'
      open={Boolean(pid)}
      onClose={handleClose}
      classes={{
        paper: 'selected__player-paper'
      }}
    >
      <div className='selected__player-header'>
        <PlayerName
          large
          headshot_width={headshot_width}
          headshot_square={is_headshot_square}
          playerMap={playerMap}
        />
        <PlayerWatchlistAction pid={pid} />
        <div className='selected__player-header-secondary'>
          <div className='selected__player-info'>
            <div className='selected-player-bio-info'>
              <div className='selected__player-header-item'>
                <label>Age</label>
                <PlayerAge date={playerMap.get('dob')} />
              </div>
              <div className='selected__player-header-item'>
                <label>Draft</label>
                {draftNum ? (
                  <>
                    {draftRound}
                    {nth(draftRound)}{' '}
                    <small>
                      (#
                      {draftNum})
                    </small>
                  </>
                ) : (
                  'UDFA'
                )}
              </div>
              <div className='selected__player-header-item'>
                <label>Exp.</label>
                {constants.year - draftYear || 'Rookie'}
              </div>
            </div>
            {has_external_link && (
              <div className='player-external-page-links'>
                {has_pfr_link && (
                  <div
                    className='player-external-page-link'
                    onClick={open_pfr_link}
                  >
                    <svg
                      version='1.1'
                      xmlns='http://www.w3.org/2000/svg'
                      width='24'
                      height='24'
                    >
                      <path
                        d='M0 0 C0 5.94 0 11.88 0 18 C-1.2375 17.505 -2.475 17.01 -3.75 16.5 C-5.73177995 16.35519353 -7.67356835 16.26389613 -9.65625 16.21875 C-14.22033868 16.01424174 -17.43375982 15.74867356 -21 12.75 C-23.08944916 10.28586125 -23.9480762 8.95097126 -24.1875 5.71875 C-24.0946875 4.74421875 -24.0946875 4.74421875 -24 3.75 C-22.58460938 4.05164063 -22.58460938 4.05164063 -21.140625 4.359375 C-17.10366091 4.83844508 -14.39906588 3.49800229 -10.86035156 1.66992188 C-6.90108643 -0.28788797 -4.82036555 0 0 0 Z '
                        fill='#0B8A4D'
                        transform='translate(24,3)'
                      />
                    </svg>
                  </div>
                )}
                {has_rotowire_link && (
                  <div
                    className='player-external-page-link'
                    onClick={open_rotowire_link}
                  >
                    <img
                      src='/static/images/external_link_icons/rotowire-icon-48.png'
                      alt='Rotowire'
                      width='24'
                      height='24'
                    />
                  </div>
                )}
                {has_fantasy_data_link && (
                  <div
                    className='player-external-page-link'
                    onClick={open_fantasy_data_link}
                  >
                    <img
                      src='/static/images/external_link_icons/fantasydata-icon-48.png'
                      alt='Fantasy Data'
                      width='24'
                      height='24'
                    />
                  </div>
                )}
                {has_espn_link && (
                  <div
                    className='player-external-page-link'
                    onClick={open_espn_link}
                  >
                    <img
                      src='/static/images/external_link_icons/espn-icon-48.png'
                      alt='ESPN'
                      width='24'
                      height='24'
                    />
                  </div>
                )}
                {has_yahoo_link && (
                  <div
                    className='player-external-page-link'
                    onClick={open_yahoo_link}
                  >
                    <img
                      src='/static/images/external_link_icons/yahoo-icon-48.png'
                      alt='Yahoo'
                      width='24'
                      height='24'
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          <div className='selected__player-header-section'>
            {is_logged_in && Boolean(tid) && (
              <div className='selected__player-header-item'>
                <label>Manager</label>
                <TeamName abbrv tid={tid} />
              </div>
            )}
            <div className='selected__player-header-item'>
              <label>Status</label>
              {player_nfl_status
                ? constants.nfl_player_status_full[player_nfl_status]
                : constants.nfl_player_status_full[
                    playerMap.get('game_status')
                  ] || 'Active'}
            </div>
            {is_logged_in && Boolean(tid) && (
              <div className='selected__player-header-item'>
                <label>Salary</label>
                {playerValue ? `$${playerValue}` : '-'}
              </div>
            )}
            {constants.season.isOffseason && (
              <div className='selected__player-header-item'>
                <label>Market</label>$
                {playerMap.getIn(['market_salary', '0'], 0)}
              </div>
            )}
            {is_before_end_of_free_agent_period && (
              <div className='selected__player-header-item'>
                <label>Adjusted</label>${market_salary_adjusted}
              </div>
            )}

            {is_logged_in && (show_collapse ? !collapsed : true) && (
              <>
                <div className='selected__player-header-item'>
                  <label>Projected Starts</label>
                  {playerMap.getIn(['lineups', 'starts'], '-')}
                </div>
                <div className='selected__player-header-item'>
                  <label>Projected Points+</label>
                  {playerMap.getIn(['lineups', 'sp'], 0).toFixed(1)}
                </div>
                <div className='selected__player-header-item'>
                  <label>Projected Bench+</label>
                  {playerMap.getIn(['lineups', 'bp'], 0).toFixed(1)}
                </div>
              </>
            )}
            {(show_collapse ? !collapsed : true) && (
              <>
                <div className='selected__player-header-item'>
                  <label>Proj/G</label>
                  {rosPoints && projWks
                    ? (rosPoints / projWks).toFixed(1)
                    : '-'}
                </div>
              </>
            )}
            {show_collapse && (
              <IconButton onClick={handleToggleExpand}>
                {collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
              </IconButton>
            )}
            {is_logged_in && (
              <PlayerContextMenu pid={pid} hideDisabled buttonGroup />
            )}
          </div>
        </div>
        <Button className='selected__player-close' onClick={handleClose}>
          <CloseIcon />
        </Button>
      </div>
      <div className='selected__player-main'>
        <Tabs
          orientation='horizontal'
          variant='scrollable'
          value={value}
          className='selected__player-menu'
          onChange={handleChange}
          defaultValue={0}
        >
          <TabsList>
            <Tab>Projections</Tab>
            <Tab>Games</Tab>
            <Tab>Seasons</Tab>
            <Tab>Schedule</Tab>
            {/* <Tab>Team Splits</Tab> */}
            {/* <Tab>Efficiency</Tab> */}
            <Tab>Practice</Tab>
            {is_logged_in && <Tab>Contribution</Tab>}
            {is_logged_in && <Tab>Value</Tab>}
            {is_logged_in && <Tab>Transactions</Tab>}
          </TabsList>
          <TabPanel value={0}>
            <SelectedPlayerProjections />
          </TabPanel>
          <TabPanel value={1}>
            <SelectedPlayerGamelogs />
          </TabPanel>
          <TabPanel value={2}>
            <SelectedPlayerSeasonStats pos={pos} />
          </TabPanel>
          <TabPanel value={3}>
            <SelectedPlayerSchedule />
          </TabPanel>
          {/* <TabPanel value={4}>
              <SelectedPlayerTeamStats />
              <SelectedPlayerTeamSituationSplits />
              <SelectedPlayerTeamPositionSplits />
              </TabPanel> */}
          {/* <TabPanel value={5}>
              <SelectedPlayerEfficiencyStats />
              </TabPanel> */}
          <TabPanel value={4}>
            <SelectedPlayerPractice />
          </TabPanel>
          <TabPanel value={5}>
            <SelectedPlayerLineupImpact />
          </TabPanel>
          <TabPanel value={6}>
            <SelectedPlayerValue />
          </TabPanel>
          <TabPanel value={7}>
            <SelectedPlayerTransactions />
          </TabPanel>
        </Tabs>
      </div>
    </Drawer>
  )
}

SelectedPlayer.propTypes = {
  deselect: PropTypes.func,
  playerMap: ImmutablePropTypes.map,
  is_logged_in: PropTypes.bool,
  market_salary_adjusted: PropTypes.number,
  is_before_end_of_free_agent_period: PropTypes.bool,
  loadAllPlayers: PropTypes.func
}
