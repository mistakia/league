import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import {
  Routes as RouterRoutes,
  Route,
  Navigate,
  useLocation,
  useParams
} from 'react-router-dom'
import queryString from 'query-string'

import { getApp } from '@core/app'
import AuthPage from '@pages/auth'
import DashboardPage from '@pages/dashboard'
import DraftPage from '@pages/draft'
import AuctionPage from '@pages/auction'
import PlayersPage from '@pages/players'
import LineupsPage from '@pages/lineups'
import TradePage from '@pages/trade'
import SettingsPage from '@pages/settings'
import MarkdownPage from '@pages/markdown'
import ScoreboardPage from '@pages/scoreboard'
import StatusPage from '@pages/status'
import PropsPage from '@pages/props'
import TransactionsPage from '@pages/transactions'
import StandingsPage from '@pages/standings'
import StatsPage from '@pages/stats'
import SchedulePage from '@pages/schedule'
import RostersPage from '@pages/rosters'
import WaiversPage from '@pages/waivers'
import TeamPage from '@pages/team'

const mapStateToProps = createSelector(getApp, (app) => ({ app }))

const LeagueRoute = () => {
  const { lid } = useParams()

  if (isNaN(lid)) {
    return <Navigate to='/' replace />
  }

  return <Navigate to={`/leagues/${lid}/rosters`} replace />
}

const Routes = ({ app }) => {
  const location = useLocation()
  const Redirect = () => {
    const { leagueId, teamId } = queryString.parse(location.search)

    if (app.userId) {
      return <Navigate to='/dashboard' />
    } else if (leagueId || teamId) {
      return <Navigate to={`/login${location.search}`} />
    } else {
      return <Navigate to='/players' />
    }
  }

  return (
    <RouterRoutes>
      {app.userId && <Route path='/dashboard' element={<DashboardPage />} />}
      {app.userId && <Route path='/lineups' element={<LineupsPage />} />}
      <Route path='/players' element={<PlayersPage />} />
      {app.userId && <Route path='/scoreboard' element={<ScoreboardPage />} />}
      {app.userId && <Route path='/auction' element={<AuctionPage />} />}
      {app.userId && <Route path='/draft' element={<DraftPage />} />}
      {app.userId && <Route path='/trade' element={<TradePage />} />}
      {!app.userId && <Route path='/login' element={<AuthPage />} />}
      <Route path='/leagues/:lid'>
        <Route path='/leagues/:lid/teams/:tid' element={<TeamPage />} />
        <Route path='/leagues/:lid/teams' element={<TeamPage />} />
        <Route
          path='/leagues/:lid/transactions'
          element={<TransactionsPage />}
        />
        <Route path='/leagues/:lid/standings' element={<StandingsPage />} />
        <Route path='/leagues/:lid/stats' element={<StatsPage />} />
        <Route path='/leagues/:lid/schedule' element={<SchedulePage />} />
        <Route path='/leagues/:lid/rosters' element={<RostersPage />} />
        <Route path='/leagues/:lid/waivers' element={<WaiversPage />} />
        <Route path='/leagues/:lid' element={<LeagueRoute />} />
      </Route>
      {app.userId && <Route path='/props' element={<PropsPage />} />}
      <Route path='/status' element={<StatusPage />} />
      <Route path='/settings' element={<SettingsPage />} />
      <Route
        path='/resources'
        element={<MarkdownPage path='/resources.md' />}
      />
      <Route path='/glossary' element={<MarkdownPage path='/glossary.md' />} />
      <Route path='*' element={<Redirect />} />
    </RouterRoutes>
  )
}

Routes.propTypes = {
  location: PropTypes.object,
  app: ImmutablePropTypes.record
}

export default connect(mapStateToProps)(Routes)
