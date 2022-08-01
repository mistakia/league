import React from 'react'
import { Outlet, NavLink, useParams } from 'react-router-dom'

import PageLayout from '@layouts/page'

export default function LeaguePage() {
  const { lid } = useParams()

  const menu = (
    <div className='menu'>
      <NavLink to={`/leagues/${lid}/transactions`}>Transactions</NavLink>
      <NavLink to={`/leagues/${lid}/waivers`}>Waivers</NavLink>
      <NavLink to={`/leagues/${lid}/rosters`}>Rosters</NavLink>
      <NavLink to={`/leagues/${lid}/standings`}>Standings</NavLink>
      <NavLink to={`/leagues/${lid}/stats`}>Stats</NavLink>
      <NavLink to={`/leagues/${lid}/schedule`}>Schedule</NavLink>
    </div>
  )

  const body = <Outlet />

  return <PageLayout body={body} menu={menu} />
}
