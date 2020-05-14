import React from 'react'
import { Route, Redirect, Switch } from 'react-router-dom'

import DashboardPage from '@pages/dashboard'
import PlayersPage from '@pages/players'
import LeaguePage from '@pages/league'

const Routes = () => (
  <Switch>
    <Route exact path='/dashboard' component={DashboardPage} />
    <Route exact path='/players' component={PlayersPage} />
    <Route path='/league' component={LeaguePage} />
    <Route exact path='/' component={() => <Redirect to='/dashboard' />} />
  </Switch>
)

export default Routes
