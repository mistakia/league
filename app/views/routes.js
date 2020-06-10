import React from 'react'
import { Route, Redirect, Switch } from 'react-router-dom'

import DashboardPage from '@pages/dashboard'
import DraftPage from '@pages/draft'
import AuctionPage from '@pages/auction'
import PlayersPage from '@pages/players'
import LineupsPage from '@pages/lineups'
import LeaguePage from '@pages/league'

const Routes = () => (
  <Switch>
    <Route exact path='/dashboard' component={DashboardPage} />
    <Route exact path='/lineups' component={LineupsPage} />
    <Route exact path='/players' component={PlayersPage} />
    <Route exact path='/auction' component={AuctionPage} />
    <Route exact path='/draft' component={DraftPage} />
    <Route path='/league' component={LeaguePage} />
    <Route exact path='/' component={() => <Redirect to='/dashboard' />} />
  </Switch>
)

export default Routes
