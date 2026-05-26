import React, { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { NavLink, useLocation } from 'react-router-dom'

import { DISCORD_URL } from '@core/constants'
import TeamName from '@components/team-name'
import LeagueSchedule from '@components/league-schedule'

import './menu.styl'

const Icon = ({ d, label, size = 24 }) => (
  <svg
    className='menu__icon'
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='currentColor'
    aria-hidden={label ? undefined : true}
    aria-label={label}
    role={label ? 'img' : undefined}
  >
    <path d={d} />
  </svg>
)

Icon.propTypes = {
  d: PropTypes.string,
  label: PropTypes.string,
  size: PropTypes.number
}

const ICON_MENU = 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z'
const ICON_INFO =
  'M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z'
const ICON_NAV_BEFORE = 'M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z'
const ICON_NAV_NEXT = 'M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z'

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
  const drawer_ref = useRef(null)

  useEffect(() => {
    if (!menu_open || !isMobile) return
    const on_key = (e) => {
      if (e.key === 'Escape') set_menu_open(false)
    }
    window.addEventListener('keydown', on_key)
    return () => window.removeEventListener('keydown', on_key)
  }, [menu_open, isMobile, set_menu_open])

  const button_style = {
    bottom: isAuction ? 204 : 16,
    [isMobile ? 'right' : 'left']: 16
  }

  const drawer_classes = ['menu__drawer']
  if (isMobile) drawer_classes.push('menu__drawer--temporary')
  else drawer_classes.push('menu__drawer--persistent')
  if (menu_open) drawer_classes.push('menu__drawer--open')
  if (isMobile) drawer_classes.push(isMobile ? 'menu__drawer--right' : 'menu__drawer--left')

  return (
    <>
      <button
        type='button'
        className='main__menu-button'
        style={button_style}
        onClick={() => set_menu_open(true)}
      >
        <Icon d={ICON_MENU} size={20} />
        <span>Menu</span>
      </button>
      {isMobile && menu_open && (
        <div
          className='menu__backdrop'
          onClick={() => set_menu_open(false)}
          aria-hidden='true'
        />
      )}
      <aside
        ref={drawer_ref}
        className={drawer_classes.join(' ')}
        aria-hidden={!menu_open}
      >
        <div className='main__menu'>
          <div className='menu__sections'>
            <div className='menu__section'>
              {league.uid ? (
                <div className='league__title'>{league.name}</div>
              ) : (
                <div className='league__warning'>
                  League not connected
                  <button
                    type='button'
                    className='menu__icon-button'
                    title='Using the default 12 team half-ppr superflex league settings. Account needed to view league connected pages and player views.'
                    aria-label='League info'
                  >
                    <Icon d={ICON_INFO} size={15} />
                  </button>
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
                <NavLink to='/plays'>Plays</NavLink>
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
          <button
            type='button'
            className='menu__collapse-button'
            title='Collapse Menu'
            aria-label='Collapse Menu'
            onClick={() => set_menu_open(false)}
          >
            <Icon d={isMobile ? ICON_NAV_NEXT : ICON_NAV_BEFORE} />
          </button>
        </div>
      </aside>
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
