import React from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import { Route, Redirect, Switch, withRouter } from 'react-router-dom'
import queryString from 'query-string'

import { getApp } from '@core/app'
import AuthPage from '@pages/auth'
import DashboardPage from '@pages/dashboard'
import DraftPage from '@pages/draft'
import AuctionPage from '@pages/auction'
import PlayersPage from '@pages/players'
import LineupsPage from '@pages/lineups'
import LeaguePage from '@pages/league'
import TradePage from '@pages/trade'
import SettingsPage from '@pages/settings'
import MarkdownPage from '@pages/markdown'

const mapStateToProps = createSelector(
  getApp,
  (app) => ({ app })
)

const Routes = ({ app, location }) => {
  const redirect = () => {
    const { leagueId, teamId } = queryString.parse(location.search)
    if (leagueId || teamId) {
      return <Redirect to={`/login${location.search}`} />
    }

    if (app.userId) {
      return <Redirect to='/dashboard' />
    } else {
      return <Redirect to='/players' />
    }
  }

  return (
    <Switch>
      {app.userId && <Route exact path='/dashboard' component={DashboardPage} />}
      {app.userId && <Route exact path='/lineups' component={LineupsPage} />}
      <Route exact path='/players' component={PlayersPage} />
      {app.userId && <Route exact path='/auction' component={AuctionPage} />}
      {app.userId && <Route exact path='/draft' component={DraftPage} />}
      {app.userId && <Route exact path='/trade' component={TradePage} />}
      {!app.userId && <Route exact path='/login' component={AuthPage} />}
      {app.userId && <Route path='/league' component={LeaguePage} />}
      <Route path='/settings' component={SettingsPage} />
      <Route
        path='/resources'
        render={(props) => (
          <MarkdownPage {...props} path='/resources.md' />
        )}
      />
      <Route
        path='/glossary'
        render={(props) => (
          <MarkdownPage {...props} path='/glossary.md' />
        )}
      />
      <Route path='*' component={redirect} />
    </Switch>
  )
}

export default withRouter(connect(
  mapStateToProps
)(Routes))
