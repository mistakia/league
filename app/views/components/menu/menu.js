import React from 'react'
import moment from 'moment'
import { NavLink } from 'react-router-dom'

import { constants } from '@common'
import './menu.styl'

const { week } = constants
const Menu = ({ app }) => (
  <div id='menu' className='menu'>
    <div className='menu__time'>{week ? `${moment().format('dddd, MMMM D, YYYY')} - Week ${week}` : `Week 1 ${moment().to(constants.start)}`}</div>
    {app.userId && <NavLink to='/dashboard'>Roster</NavLink>}
    {app.userId && <NavLink to='/lineups'>Lineup</NavLink>}
    <NavLink to='/players'>Players</NavLink>
    {app.userId && <NavLink to='/league'>League</NavLink>}
    {app.userId && <NavLink to='/trade'>Trade</NavLink>}
    {(app.userId && !week) && <NavLink to='/draft'>Draft</NavLink>}
    {(app.userId && !week) && <NavLink to='/auction'>Auction</NavLink>}
    <NavLink to='/settings'>Settings</NavLink>
    <NavLink to='/resources'>Resources</NavLink>
    {!app.userId && <NavLink to='/login'>Login/Register</NavLink>}
  </div>
)

export default Menu
