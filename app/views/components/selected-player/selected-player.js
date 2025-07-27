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
import ButtonGroup from '@mui/material/ButtonGroup'

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
import SelectedPlayerMarkets from '@components/selected-player-markets'
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
  player_map,
  is_logged_in,
  market_salary_adjusted,
  is_before_live_auction_end,
  deselect,
  load_all_players,
  is_hosted_league
}) {
  const projectionView = 0
  const transactionsView = 8
  const [value, setValue] = useState(
    is_logged_in && is_hosted_league ? transactionsView : projectionView
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
    if (is_before_live_auction_end) {
      load_all_players()
    }
  }, [is_before_live_auction_end, load_all_players])

  const handleChange = (event, value) => setValue(value)
  const handleToggleExpand = (event) => setCollapsed(!collapsed)
  const handleClose = () => deselect()

  useEffect(() => {
    const element = document.querySelector('.base-Tab-root.Mui-selected')
    if (element) element.scrollIntoView({ behavior: 'smooth' })
  }, [value])

  const blacklist = ['0', 'ros']
  const projWks = player_map
    .get('projection', new Map())
    .keySeq()
    .toArray()
    .filter((week) => !blacklist.includes(week)).length

  const pos = player_map.get('pos')
  const pid = player_map.get('pid')
  const tid = player_map.get('tid', false)
  const player_nfl_status = player_map.get('nfl_status')
  const draftNum = player_map.get('dpos')
  const draftYear = player_map.get('nfl_draft_year')
  const draftRound = player_map.get('round')
  const playerValue = player_map.get('value')
  const rosPoints = player_map.getIn(['points', 'ros', 'total'], 0)

  const external_button_items = []

  const has_pfr_link = Boolean(
    player_map.get('lname') && player_map.get('pfr_id')
  )
  if (has_pfr_link) {
    const open_pfr_link = () => {
      window.open(
        `https://www.pro-football-reference.com/players/${player_map.get('lname')[0].toUpperCase()}/${player_map.get('pfr_id')}.htm`,
        '_blank'
      )
    }
    external_button_items.push(
      <Button size='small' onClick={open_pfr_link}>
        PFR
      </Button>
    )
  }

  const has_rotowire_link = Boolean(player_map.get('rotowire_id'))
  if (has_rotowire_link) {
    const open_rotowire_link = () => {
      window.open(
        `https://rotowire.com/football/player.php?id=${player_map.get('rotowire_id')}`,
        '_blank'
      )
    }
    external_button_items.push(
      <Button size='small' onClick={open_rotowire_link}>
        Rotowire
      </Button>
    )
  }

  const has_fantasy_data_link = Boolean(player_map.get('fantasy_data_id'))
  if (has_fantasy_data_link) {
    const open_fantasy_data_link = () => {
      window.open(
        `https://fantasydata.com/nfl/player-fantasy/${player_map.get('fantasy_data_id')}`,
        '_blank'
      )
    }
    external_button_items.push(
      <Button size='small' onClick={open_fantasy_data_link}>
        FantasyData
      </Button>
    )
  }

  const has_espn_link = Boolean(player_map.get('espn_id'))
  if (has_espn_link) {
    const open_espn_link = () => {
      window.open(
        `https://www.espn.com/nfl/player/_/id/${player_map.get('espn_id')}`,
        '_blank'
      )
    }
    external_button_items.push(
      <Button size='small' onClick={open_espn_link}>
        ESPN
      </Button>
    )
  }

  const has_yahoo_link = Boolean(player_map.get('yahoo_id'))
  if (has_yahoo_link) {
    const open_yahoo_link = () => {
      window.open(
        `https://sports.yahoo.com/nfl/players/${player_map.get('yahoo_id')}`,
        '_blank'
      )
    }
    external_button_items.push(
      <Button size='small' onClick={open_yahoo_link}>
        Yahoo
      </Button>
    )
  }

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
          player_map={player_map}
        />
        <PlayerWatchlistAction pid={pid} />
        <div className='selected__player-header-secondary'>
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
                    player_map.get('game_status')
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
                {player_map.getIn(['market_salary', '0'], 0)}
              </div>
            )}
            {is_logged_in && is_hosted_league && is_before_live_auction_end && (
              <div className='selected__player-header-item'>
                <label>Adjusted</label>${market_salary_adjusted}
              </div>
            )}

            {is_logged_in &&
              is_hosted_league &&
              (show_collapse ? !collapsed : true) && (
                <>
                  <div className='selected__player-header-item'>
                    <label>Projected Starts</label>
                    {player_map.getIn(['lineups', 'starts'], '-')}
                  </div>
                  <div className='selected__player-header-item'>
                    <label>Projected Points+</label>
                    {player_map.getIn(['lineups', 'sp'], 0).toFixed(1)}
                  </div>
                  <div className='selected__player-header-item'>
                    <label>Projected Bench+</label>
                    {player_map.getIn(['lineups', 'bp'], 0).toFixed(1)}
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
            <div className='selected__player-header-item'>
              <label>Age</label>
              <PlayerAge date={player_map.get('dob')} />
            </div>
            {draftNum != null && draftNum !== undefined && (
              <>
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
              </>
            )}
            {show_collapse && (
              <IconButton onClick={handleToggleExpand}>
                {collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
              </IconButton>
            )}
          </div>
        </div>
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
            <Tab>Games</Tab>
            <Tab>Seasons</Tab>
            <Tab>Schedule</Tab>
            <Tab>Projections</Tab>
            {/* <Tab>Team Splits</Tab> */}
            {/* <Tab>Efficiency</Tab> */}
            <Tab>Practice</Tab>
            <Tab>Betting Markets</Tab>
            {is_logged_in && is_hosted_league && (
              <>
                <Tab>Contribution</Tab>
                <Tab>Value</Tab>
                <Tab>Transactions</Tab>
              </>
            )}
          </TabsList>
          <TabPanel value={0}>
            <SelectedPlayerGamelogs />
          </TabPanel>
          <TabPanel value={1}>
            <SelectedPlayerSeasonStats pos={pos} />
          </TabPanel>
          <TabPanel value={2}>
            <SelectedPlayerSchedule />
          </TabPanel>
          <TabPanel value={3}>
            <SelectedPlayerProjections />
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
            <SelectedPlayerMarkets />
          </TabPanel>
          {is_logged_in && is_hosted_league && (
            <>
              <TabPanel value={6}>
                <SelectedPlayerLineupImpact />
              </TabPanel>
              <TabPanel value={7}>
                <SelectedPlayerValue />
              </TabPanel>
              <TabPanel value={8}>
                <SelectedPlayerTransactions />
              </TabPanel>
            </>
          )}
        </Tabs>
      </div>
      <div className='selected__player-actions-container'>
        <div className='selected__player-actions'>
          {is_logged_in && (
            <PlayerContextMenu pid={pid} hideDisabled buttonGroup />
          )}
          {external_button_items.length > 0 && (
            <ButtonGroup variant='contained'>
              {external_button_items}
            </ButtonGroup>
          )}
        </div>
        <div className='selected__player-actions-close'>
          <Button variant='contained' onClick={handleClose}>
            <CloseIcon />
          </Button>
        </div>
      </div>
    </Drawer>
  )
}

SelectedPlayer.propTypes = {
  deselect: PropTypes.func,
  player_map: ImmutablePropTypes.map,
  is_logged_in: PropTypes.bool,
  market_salary_adjusted: PropTypes.number,
  is_before_live_auction_end: PropTypes.bool,
  load_all_players: PropTypes.func,
  is_hosted_league: PropTypes.bool
}
