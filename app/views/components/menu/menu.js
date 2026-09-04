import React, { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { Link, NavLink } from 'react-router-dom'

import { DISCORD_URL } from '@core/constants'
import { league_url } from '@pages/genesis-league/genesis-league-content'
import Accordion from '@components/accordion'
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

const ICON_INFO =
  'M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z'
const ICON_NAV_BEFORE =
  'M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z'
const ICON_NAV_NEXT = 'M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z'

export default function AppMenu({
  menu_open,
  set_menu_open,
  logout,
  is_logged_in,
  teamId,
  leagueId,
  league,
  user_leagues = [],
  is_commish,
  open_contribution_dialog
}) {
  const isMobile = window.innerWidth < 800
  // Requires the CONNECTED league to be one of them, not just that there are
  // two. A manager can browse into a league they do not belong to, and a
  // switcher whose value matches no option renders showing its first one --
  // so the sidebar would name a league other than the page below it.
  const show_league_switcher =
    user_leagues.length > 1 &&
    user_leagues.some((entry) => entry.league_id === leagueId)
  const is_hosted = Boolean(league.is_hosted)
  // The home dynasty league is the one league_url points at, and its menu
  // section is visible exactly when the connected league is that one — the
  // separate button must not duplicate it. Keyed on the league, not the route:
  // a client-side navigation off the league pages leaves app.leagueId in place,
  // so the section stays visible and the button must stay hidden with it.
  const is_genesis_league = leagueId === Number(league_url.split('/').pop())
  const drawer_ref = useRef(null)

  useEffect(() => {
    if (!menu_open || !isMobile) return
    const on_key = (e) => {
      if (e.key === 'Escape') set_menu_open(false)
    }
    window.addEventListener('keydown', on_key)
    return () => window.removeEventListener('keydown', on_key)
  }, [menu_open, isMobile, set_menu_open])

  const drawer_classes = ['menu__drawer']
  if (isMobile) drawer_classes.push('menu__drawer--temporary')
  else drawer_classes.push('menu__drawer--persistent')
  if (menu_open) drawer_classes.push('menu__drawer--open')
  if (isMobile)
    drawer_classes.push(isMobile ? 'menu__drawer--right' : 'menu__drawer--left')

  return (
    <>
      <button
        type='button'
        className='main__menu-button'
        onClick={() => set_menu_open(true)}
      >
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
              {league.league_id ? (
                show_league_switcher ? (
                  // THE APP'S ACCORDION, NOT A SELECT, AND THE REASON IS THE
                  // TITLE ITSELF. A `select` renders its chosen option on ONE
                  // line and truncates what does not fit -- it cannot wrap --
                  // and at 21px IBM Plex Mono in a 176px card that clips even
                  // "GENESIS LEAGUE", never mind "GENESIS LEAGUE (auction
                  // mirror)". It also reports a min-content width driven by its
                  // widest OPTION, which is what widened the whole drawer the
                  // first time this shipped. A disclosure has neither problem:
                  // the summary is an ordinary flex box, so the league name
                  // wraps and reads in full exactly as the static title does,
                  // and no option list contributes to layout at all.
                  //
                  // Also no floating surface, so no layer on the z-index scale
                  // and no portal -- the panel is in flow, and `.main__menu`
                  // already scrolls.
                  //
                  // LINKS, not a change handler. The route is what drives
                  // app.leagueId -- app.js selects the matched route's league on
                  // every change -- so a real anchor keeps the URL and the store
                  // in agreement, and middle-click and open-in-new-tab work for
                  // free. Each one lands on the league home rather than the
                  // current sub-page: half the league routes carry an id
                  // belonging to the league being left (/teams/:tid,
                  // /matchups/:matchupId), so carrying the path across would
                  // produce a valid URL naming a team in another league.
                  <Accordion className='league__switcher' summary={league.name}>
                    <div
                      className='menu__links league__switcher-list'
                      onClick={() => isMobile && set_menu_open(false)}
                    >
                      {user_leagues.map(({ league_id, name }) => (
                        <Link
                          key={league_id}
                          to={`/leagues/${league_id}`}
                          className={
                            league_id === leagueId ? 'active' : undefined
                          }
                          // The connected league, not the matched route. A
                          // NavLink would mark this from the URL, which reads
                          // the wrong answer on every sub-page.
                          aria-current={
                            league_id === leagueId ? 'true' : undefined
                          }
                        >
                          {name}
                        </Link>
                      ))}
                    </div>
                  </Accordion>
                ) : (
                  <div className='league__title'>{league.name}</div>
                )
              ) : (
                // Only a signed-in user can connect a league, so the warning is
                // actionable for them and reads as site breakage to everyone
                // else — it is the first thing an anonymous prospect sees in
                // the sidebar on the landing page.
                is_logged_in && (
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
                )
              )}
              {Boolean(league.league_id) && <LeagueSchedule />}
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
                <NavLink to='/data-views'>Data Views</NavLink>
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
                        <NavLink
                          to={`/leagues/${leagueId}/restricted-free-agency`}
                        >
                          Restricted Free Agency
                        </NavLink>
                        <NavLink to={`/leagues/${leagueId}/trades`}>
                          Trades
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
            {/* The home dynasty league is publicly readable without an
                account, so an anonymous visitor anywhere else gets a path back
                to it. Once the league section is showing it, the league links
                above already cover every league page, so a separate link would
                be noise. */}
            {!is_logged_in && !is_genesis_league && (
              <div className='menu__section'>
                <div
                  className='menu__links'
                  onClick={() => isMobile && set_menu_open(false)}
                >
                  <NavLink to={league_url} end>
                    Genesis League
                  </NavLink>
                </div>
              </div>
            )}
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
                {is_logged_in && (
                  <NavLink to='/contributions'>My Reports</NavLink>
                )}
              </div>
            </div>
            <div className='menu__section'>
              <div
                className='menu__links'
                onClick={() => isMobile && set_menu_open(false)}
              >
                {/* The menu is the only navigation surface present on every
                    route, which is why the report entry lives here rather than
                    on a page. An anchor rather than a NavLink: it opens a
                    dialog over the current page instead of navigating, since a
                    report is about the page the reporter is already on. */}
                <a onClick={() => open_contribution_dialog()}>
                  Report a problem
                </a>
                <NavLink to='/constitution'>Rules</NavLink>
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
  user_leagues: PropTypes.array,
  logout: PropTypes.func,
  menu_open: PropTypes.bool,
  set_menu_open: PropTypes.func,
  is_commish: PropTypes.bool,
  open_contribution_dialog: PropTypes.func
}
