import React from 'react'
import { Route, Switch, Redirect, NavLink } from 'react-router-dom'

import TransactionsPage from '@pages/transactions'
import StandingsPage from '@pages/standings'
import StatsPage from '@pages/stats'
import SchedulePage from '@pages/schedule'
import RostersPage from '@pages/rosters'
import PageLayout from '@layouts/page'
import WaiversPage from '@pages/waivers'

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

  const body = (
    <Switch>
      <Route exact path='/league/transactions' component={TransactionsPage} />
      <Route exact path='/league/standings' component={StandingsPage} />
      <Route exact path='/league/stats' component={StatsPage} />
      <Route exact path='/league/schedule' component={SchedulePage} />
      <Route exact path='/league/rosters' component={RostersPage} />
      <Route exact path='/league/waivers' component={WaiversPage} />
      <Route
        exact
        path='/league'
        component={() => <Redirect to='/league/transactions' />}
      />
    </Switch>
  )

  return <PageLayout body={body} menu={menu} />
}
