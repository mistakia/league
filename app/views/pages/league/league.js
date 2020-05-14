import React from 'react'
import { Route, Switch, Redirect, NavLink } from 'react-router-dom'

import TransactionsPage from '@pages/transactions'
import StandingsPage from '@pages/standings'
import StatsPage from '@pages/stats'
import SchedulePage from '@pages/schedule'
import DraftPage from '@pages/draft'
import AuctionPage from '@pages/auction'
import RostersPage from '@pages/rosters'
import PageLayout from '@layouts/page'

export default function () {
  const menu = (
    <div className='menu'>
      <NavLink to='/league/transactions'>Transactions</NavLink>
      <NavLink to='/league/rosters'>Rosters</NavLink>
      <NavLink to='/league/standings'>Standings</NavLink>
      <NavLink to='/league/stats'>Stats</NavLink>
      <NavLink to='/league/schedule'>Schedule</NavLink>
      <NavLink to='/league/draft'>Draft</NavLink>
      <NavLink to='/league/auction'>Auction</NavLink>
    </div>
  )

  const body = (
    <Switch>
      <Route exact path='/league/transactions' component={TransactionsPage} />
      <Route exact path='/league/standings' component={StandingsPage} />
      <Route exact path='/league/stats' component={StatsPage} />
      <Route exact path='/league/schedule' component={SchedulePage} />
      <Route exact path='/league/draft' component={DraftPage} />
      <Route exact path='/league/rosters' component={RostersPage} />
      <Route exact path='/league/auction' component={AuctionPage} />
      <Route exact path='/league' component={() => <Redirect to='/league/transactions' />} />
    </Switch>
  )

  return (
    <PageLayout body={body} menu={menu} />
  )
}
