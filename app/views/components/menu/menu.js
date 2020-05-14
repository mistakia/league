import React from 'react'
import { NavLink } from 'react-router-dom'

import './menu.styl'

const Menu = () => (
  <div id='menu' className='menu'>
    <NavLink to='/dashboard'>Home</NavLink>
    <NavLink to='/players'>Players</NavLink>
    <NavLink to='/league'>League</NavLink>
  </div>
)

export default Menu
