import React from 'react'
import { NavLink } from 'react-router-dom'

import { constants } from '@common'
const { week } = constants

import './menu.styl'

const Menu = () => (
  <div id='menu' className='menu'>
    <NavLink to='/dashboard'>Roster</NavLink>
    <NavLink to='/lineups'>Lineups</NavLink>
    <NavLink to='/players'>Players</NavLink>
    <NavLink to='/league'>League</NavLink>
    { !week && <NavLink to='/draft'>Draft</NavLink> }
    { !week && <NavLink to='/auction'>Auction</NavLink> }
  </div>
)

export default Menu
