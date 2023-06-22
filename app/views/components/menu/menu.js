import React from 'react'
import PropTypes from 'prop-types'
import { NavLink, useLocation } from 'react-router-dom'
import MenuIcon from '@mui/icons-material/Menu'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'
import Fab from '@mui/material/Fab'
import Tooltip from '@mui/material/Tooltip'
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'

import TeamName from '@components/team-name'
import LeagueSchedule from '@components/league-schedule'

import './menu.styl'

export default function AppMenu({
  menu_open,
  set_menu_open,
  logout,
  isLoggedIn,
  teamId,
  leagueId,
  league,
  isCommish
}) {
  const location = useLocation()
  const isAuction = location.pathname === '/auction'
  const isMobile = window.innerWidth < 800
  const is_hosted = Boolean(league.hosted)

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
                {Boolean(leagueId) && (
                  <NavLink to={`/leagues/${leagueId}`} end>
                    Home
                  </NavLink>
                )}
                {isCommish && (
                  <NavLink to={`/leagues/${leagueId}/settings`}>
                    Settings
                  </NavLink>
                )}
                {Boolean(leagueId) && is_hosted && (
                  <>
                    <NavLink to={`/leagues/${leagueId}/auction`}>
                      Auction
                    </NavLink>
                    <NavLink to={`/leagues/${leagueId}/draft`}>Draft</NavLink>
                    <NavLink to={`/leagues/${leagueId}/matchups`}>
                      Matchups
                    </NavLink>
                  </>
                )}
                <NavLink to={`/leagues/${leagueId}/players`}>Players</NavLink>
                {Boolean(leagueId) && (
                  <>
                    <NavLink to={`/leagues/${leagueId}/rosters`}>
                      Rosters
                    </NavLink>
                    {is_hosted && (
                      <>
                        <NavLink to={`/leagues/${leagueId}/schedule`}>
                          Schedule
                        </NavLink>
                        <NavLink to={`/leagues/${leagueId}/standings`}>
                          Standings
                        </NavLink>
                        <NavLink to={`/leagues/${leagueId}/stats`}>
                          Stats
                        </NavLink>
                      </>
                    )}
                    {teamId ? (
                      <NavLink to={`/leagues/${leagueId}/teams/${teamId}`}>
                        Teams
                      </NavLink>
                    ) : (
                      <NavLink to={`/leagues/${leagueId}/teams`}>Teams</NavLink>
                    )}
                    {is_hosted && (
                      <>
                        <NavLink to={`/leagues/${leagueId}/transactions`}>
                          Transactions
                        </NavLink>
                        <NavLink to={`/leagues/${leagueId}/waivers`}>
                          Waivers
                        </NavLink>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
            {Boolean(teamId) && is_hosted && (
              <div className='menu__section'>
                <div className='menu__heading'>
                  <TeamName image abbrv tid={teamId} />
                </div>
                <div
                  className='menu__links'
                  onClick={() => isMobile && set_menu_open(false)}
                >
                  <NavLink to={`/leagues/${leagueId}/teams/${teamId}`}>
                    Team
                  </NavLink>
                  <NavLink to='/lineups'>Lineup</NavLink>
                  <NavLink to='/trade'>Trade</NavLink>
                  <NavLink to='/settings'>Settings</NavLink>
                </div>
              </div>
            )}
            <div className='menu__section'>
              <div className='menu__heading'>Account</div>
              <div
                className='menu__links'
                onClick={() => isMobile && set_menu_open(false)}
              >
                {isLoggedIn ? (
                  <a onClick={logout}>Logout</a>
                ) : (
                  <NavLink to='/login'>Login</NavLink>
                )}
              </div>
            </div>
            <div className='menu__section'>
              <div className='menu__heading'>The Machine</div>
              <div
                className='menu__links'
                onClick={() => isMobile && set_menu_open(false)}
              >
                <NavLink to='/props'>Props</NavLink>
                <NavLink to='/status'>Status</NavLink>
                <NavLink to='/glossary'>Glossary</NavLink>
                <NavLink to='/resources'>Resources</NavLink>
              </div>
            </div>
          </div>
        </div>
        <div className='menu__collapse'>
          <Tooltip title='Collapse Menu'>
            <Fab color='primary' onClick={() => set_menu_open(false)}>
              {isMobile ? <NavigateNextIcon /> : <NavigateBeforeIcon />}
            </Fab>
          </Tooltip>
        </div>
      </SwipeableDrawer>
    </>
  )
}

AppMenu.propTypes = {
  isLoggedIn: PropTypes.bool,
  leagueId: PropTypes.number,
  teamId: PropTypes.number,
  league: PropTypes.object,
  logout: PropTypes.func,
  menu_open: PropTypes.bool,
  set_menu_open: PropTypes.func,
  isCommish: PropTypes.bool
}
