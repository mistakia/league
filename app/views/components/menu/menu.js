import React, { useState } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { NavLink, useLocation } from 'react-router-dom'
import MenuIcon from '@mui/icons-material/Menu'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'
import Avatar from '@mui/material/Avatar'
import Fab from '@mui/material/Fab'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import Popover from '@mui/material/Popover'

import TeamName from '@components/team-name'
import LeagueSchedule from '@components/league-schedule'

import { constants } from '@common'
import { history } from '@core/store'

import './menu.styl'

export default function AppMenu({
  menu_open,
  set_menu_open,
  logout,
  isLoggedIn,
  teamId,
  team,
  leagueId,
  league
}) {
  const location = useLocation()
  const isAuction = location.pathname === '/auction'
  const isMobile = window.innerWidth < 800

  const [anchor_el_account, set_anchor_el_account] = useState(null)

  const handleClick = (path) => () => {
    set_anchor_el_account(null)
    if (isMobile) set_menu_open(false)
    history.push(path)
  }

  const sx = isMobile ? { right: 16 } : { left: 16 }

  return (
    <>
      <Fab
        sx={{ position: 'fixed', bottom: isAuction ? 204 : 16, ...sx }}
        color='primary'
        variant='extended'
        className='main__menu-button'
        onClick={() => set_menu_open(true)}
      >
        <MenuIcon sx={{ mr: 1 }} />
        Menu
      </Fab>
      <SwipeableDrawer
        variant={isMobile ? 'temporary' : 'persistent'}
        anchor={isMobile ? 'right' : 'left'}
        open={menu_open}
        onOpen={() => set_menu_open(true)}
        onClose={() => set_menu_open(false)}
        classes={{
          paper: 'menu__drawer'
        }}
      >
        <div className='main__menu'>
          <div className='menu__sections'>
            <div className='menu__section'>
              <div className='league__title'>{league.name}</div>
              <LeagueSchedule />
              <div
                className='menu__links'
                onClick={() => isMobile && set_menu_open(false)}
              >
                {Boolean(leagueId) && <NavLink to='/dashboard'>Home</NavLink>}
                <NavLink to='/players'>Players</NavLink>
                {Boolean(leagueId) && (
                  <>
                    {Boolean(constants.week) && (
                      <NavLink to='/scoreboard'>Scoreboard</NavLink>
                    )}
                    {teamId ? (
                      <NavLink to={`/leagues/${leagueId}/teams/${teamId}`}>
                        Teams
                      </NavLink>
                    ) : (
                      <NavLink to={`/leagues/${leagueId}/teams`}>Teams</NavLink>
                    )}
                    <NavLink to={`/leagues/${leagueId}/transactions`}>
                      Transactions
                    </NavLink>
                    <NavLink to={`/leagues/${leagueId}/waivers`}>
                      Waivers
                    </NavLink>
                    <NavLink to={`/leagues/${leagueId}/rosters`}>
                      Rosters
                    </NavLink>
                    <NavLink to={`/leagues/${leagueId}/standings`}>
                      Standings
                    </NavLink>
                    <NavLink to={`/leagues/${leagueId}/stats`}>Stats</NavLink>
                    <NavLink to={`/leagues/${leagueId}/schedule`}>
                      Schedule
                    </NavLink>
                  </>
                )}
              </div>
            </div>
            {Boolean(teamId) && (
              <div className='menu__section'>
                <div className='menu__heading'>
                  <TeamName image abbrv tid={teamId} />
                </div>
                <div
                  className='menu__links'
                  onClick={() => isMobile && set_menu_open(false)}
                >
                  <NavLink to='/lineups'>Lineup</NavLink>
                  <NavLink to='/trade'>Trade</NavLink>
                  <NavLink to='/draft'>Draft</NavLink>
                  <NavLink to='/auction'>Auction</NavLink>
                </div>
              </div>
            )}
            <div className='menu__section'>
              <div className='menu__heading'>Site</div>
              <div
                className='menu__links'
                onClick={() => isMobile && set_menu_open(false)}
              >
                <NavLink to='/status'>Status</NavLink>
                <NavLink to='/glossary'>Glossary</NavLink>
                <NavLink to='/resources'>Resources</NavLink>
              </div>
            </div>
          </div>
        </div>
        <div className='menu__actions'>
          <Tooltip title='View Account'>
            <IconButton
              variant='text'
              onClick={(event) => set_anchor_el_account(event.currentTarget)}
            >
              <Avatar alt='' />
            </IconButton>
          </Tooltip>
          <Popover
            sx={{ mt: '45px' }}
            anchorEl={anchor_el_account}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right'
            }}
            transformOrigin={{
              vertical: 'bottom',
              horizontal: 'left'
            }}
            open={Boolean(anchor_el_account)}
            onClose={() => set_anchor_el_account(null)}
          >
            <MenuItem onClick={handleClick('/settings')}>
              <Typography textAlign='center'>Settings</Typography>
            </MenuItem>
            {!isLoggedIn && (
              <MenuItem onClick={handleClick('/login')}>
                Login/Register
              </MenuItem>
            )}
            {isLoggedIn && <MenuItem onClick={logout}>Logout</MenuItem>}
          </Popover>
          <div className='menu__collapse'>
            <Tooltip title='Collapse Menu'>
              <IconButton onClick={() => set_menu_open(false)}>
                {isMobile ? <NavigateNextIcon /> : <NavigateBeforeIcon />}
              </IconButton>
            </Tooltip>
          </div>
        </div>
      </SwipeableDrawer>
    </>
  )
}

AppMenu.propTypes = {
  isLoggedIn: PropTypes.bool,
  leagueId: PropTypes.number,
  teamId: PropTypes.number,
  team: ImmutablePropTypes.record,
  league: PropTypes.object,
  logout: PropTypes.func,
  menu_open: PropTypes.bool,
  set_menu_open: PropTypes.func
}
