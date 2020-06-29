import React from 'react'
import { NavLink } from 'react-router-dom'

import { constants } from '@common'
import './menu.styl'

const { week } = constants
const Menu = () => (
  <div id='menu' className='menu'>
    <NavLink to='/dashboard'>Roster</NavLink>
    <NavLink to='/lineups'>Lineup</NavLink>
    <NavLink to='/players'>Players</NavLink>
    <NavLink to='/league'>League</NavLink>
    <NavLink to='/trade'>Trade</NavLink>
    <NavLink to='/settings'>Settings</NavLink>
    {!week && <NavLink to='/draft'>Draft</NavLink>}
    {!week && <NavLink to='/auction'>Auction</NavLink>}
  </div>
)

export default Menu
