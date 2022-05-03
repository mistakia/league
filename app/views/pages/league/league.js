import React from 'react'
import { Outlet, NavLink } from 'react-router-dom'

import PageLayout from '@layouts/page'

export default function LeaguePage() {
  const menu = (
    <div className='menu'>
      <NavLink to='/league/transactions'>Transactions</NavLink>
      <NavLink to='/league/waivers'>Waivers</NavLink>
      <NavLink to='/league/rosters'>Rosters</NavLink>
      <NavLink to='/league/standings'>Standings</NavLink>
      <NavLink to='/league/stats'>Stats</NavLink>
      <NavLink to='/league/schedule'>Schedule</NavLink>
    </div>
  )

  const body = <Outlet />

  return <PageLayout body={body} menu={menu} />
}
