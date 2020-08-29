import React from 'react'
import { NavLink } from 'react-router-dom'

import LeagueSchedule from '@components/league-schedule'
import { constants } from '@common'
import './menu.styl'

const week = constants.season.week
const Menu = ({ app }) => (
  <div id='menu' className='menu'>
    <LeagueSchedule />
    {app.userId && <NavLink to='/dashboard'>Roster</NavLink>}
    {app.userId && <NavLink to='/lineups'>Lineup</NavLink>}
    <NavLink to='/players'>Players</NavLink>
    {app.userId && <NavLink to='/scoreboard'>Scoreboard</NavLink>}
    {app.userId && <NavLink to='/league'>League</NavLink>}
    {app.userId && <NavLink to='/trade'>Trade</NavLink>}
    {(app.userId && !week) && <NavLink to='/draft'>Draft</NavLink>}
    {(app.userId && !week) && <NavLink to='/auction'>Auction</NavLink>}
    <NavLink to='/settings'>Settings</NavLink>
    <NavLink to='/resources'>Resources</NavLink>
    <NavLink to='/glossary'>Glossary</NavLink>
    {!app.userId && <NavLink to='/login'>Login/Register</NavLink>}
  </div>
)

export default Menu
