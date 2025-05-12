import React from 'react'
import PropTypes from 'prop-types'
import { NavLink, useLocation } from 'react-router-dom'
import MenuIcon from '@mui/icons-material/Menu'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'
import Fab from '@mui/material/Fab'
import Tooltip from '@mui/material/Tooltip'
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import IconButton from '@mui/material/IconButton'
import InfoIcon from '@mui/icons-material/Info'

import { DISCORD_URL } from '@core/constants'
import TeamName from '@components/team-name'
import LeagueSchedule from '@components/league-schedule'

import './menu.styl'

export default function AppMenu({
  menu_open,
  set_menu_open,
  logout,
  is_logged_in,
  teamId,
  leagueId,
  league,
  is_commish
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
              {league.uid ? (
                <div className='league__title'>{league.name}</div>
              ) : (
                <div className='league__warning'>
                  League not connected
                  <Tooltip
                    PopperProps={{ className: 'multiline' }}
                    title={
                      <span>
                        Using the default 12 team half-ppr superflex league
                        settings.
                        <br />
                        <br />
                        Account needed to view league connected pages and player
                        views.
                      </span>
                    }
                  >
                    <IconButton size='small'>
                      <InfoIcon />
                    </IconButton>
                  </Tooltip>
                </div>
              )}
              {Boolean(league.uid) && <LeagueSchedule />}
              <div
                className='menu__links'
                onClick={() => isMobile && set_menu_open(false)}
              >
                {Boolean(leagueId) && (
                  <NavLink to={`/leagues/${leagueId}`} end>
                    Front Office
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
                <NavLink to='/data-views'>Data Views (Beta)</NavLink>
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
                {is_logged_in && is_commish && (
                  <NavLink to={`/leagues/${leagueId}/settings`}>
                    Settings
                  </NavLink>
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
                  <NavLink to={`/leagues/${leagueId}/team-settings`}>
                    Settings
                  </NavLink>
                </div>
              </div>
            )}
            <div className='menu__section'>
              <div className='menu__heading'>Account</div>
              <div
                className='menu__links'
                onClick={() => isMobile && set_menu_open(false)}
              >
                {is_logged_in ? (
                  <a onClick={logout}>Logout</a>
                ) : (
                  <NavLink to='/login'>Login</NavLink>
                )}
                {is_logged_in && <NavLink to='/settings'>Settings</NavLink>}
              </div>
            </div>
            <div className='menu__section'>
              <div
                className='menu__links'
                onClick={() => isMobile && set_menu_open(false)}
              >
                <NavLink to='/about'>About</NavLink>
                {/* <NavLink to='/props'>Props</NavLink> */}
                {/* <NavLink to='/status'>Status</NavLink> */}
                <a
                  href='https://github.com/mistakia/league'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  GitHub
                </a>
                <a href={DISCORD_URL} target='_blank' rel='noopener noreferrer'>
                  Discord
                </a>
                <a
                  href='https://github.com/users/mistakia/projects/3/views/1'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  Roadmap
                </a>
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
  is_logged_in: PropTypes.bool,
  leagueId: PropTypes.number,
  teamId: PropTypes.number,
  league: PropTypes.object,
  logout: PropTypes.func,
  menu_open: PropTypes.bool,
  set_menu_open: PropTypes.func,
  is_commish: PropTypes.bool
}
