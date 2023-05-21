import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import {
  Routes as RouterRoutes,
  Route,
  Navigate,
  useLocation
} from 'react-router-dom'
import queryString from 'query-string'

import { get_app } from '@core/selectors'
import AuthPage from '@pages/auth'
import LeagueHomePage from '@pages/league-home'
import DraftPage from '@pages/draft'
import AuctionPage from '@pages/auction'
import PlayersPage from '@pages/players'
import LineupsPage from '@pages/lineups'
import TradePage from '@pages/trade'
import SettingsPage from '@pages/settings'
import MarkdownPage from '@pages/markdown'
import StatusPage from '@pages/status'
import PropsPage from '@pages/props'
import TransactionsPage from '@pages/transactions'
import StandingsPage from '@pages/standings'
import StatsPage from '@pages/stats'
import SchedulePage from '@pages/schedule'
import RostersPage from '@pages/rosters'
import WaiversPage from '@pages/waivers'
import TeamPage from '@pages/team'
import LeagueSettingsPage from '@pages/league-settings'
import MatchupPage from '@pages/matchup'

const mapStateToProps = createSelector(get_app, (app) => ({ app }))

const Routes = ({ app }) => {
  const location = useLocation()
  const UnmatchedRoute = () => {
    const { leagueId, teamId } = queryString.parse(location.search)

    if (app.leagueId) {
      return <Navigate to={`/leagues/${app.leagueId}`} />
    } else if (leagueId || teamId) {
      return <Navigate to={`/login${location.search}`} />
    } else {
      return <Navigate to='/players' />
    }
  }

  return (
    <RouterRoutes>
      {app.userId && <Route path='/lineups' element={<LineupsPage />} />}
      <Route path='/players' element={<PlayersPage />} />
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
        <Route path='/leagues/:lid/matchups' element={<MatchupPage />} />
        <Route
          path='/leagues/:lid/matchups/:seas_year/:seas_week'
          element={<MatchupPage />}
        />
        <Route
          path='/leagues/:lid/matchups/:seas_year/:seas_week/:matchupId'
          element={<MatchupPage />}
        />
        <Route path='/leagues/:lid/standings' element={<StandingsPage />} />
        <Route path='/leagues/:lid/stats' element={<StatsPage />} />
        <Route path='/leagues/:lid/schedule' element={<SchedulePage />} />
        <Route path='/leagues/:lid/rosters' element={<RostersPage />} />
        <Route path='/leagues/:lid/waivers' element={<WaiversPage />} />
        <Route path='/leagues/:lid/settings' element={<LeagueSettingsPage />} />
        <Route path='/leagues/:lid' element={<LeagueHomePage />} />
      </Route>
      <Route path='/props' element={<PropsPage />} />
      <Route path='/status' element={<StatusPage />} />
      <Route path='/settings' element={<SettingsPage />} />
      <Route
        path='/resources'
        element={<MarkdownPage path='/resources.md' />}
      />
      <Route path='/glossary' element={<MarkdownPage path='/glossary.md' />} />
      <Route path='*' element={<UnmatchedRoute />} />
    </RouterRoutes>
  )
}

Routes.propTypes = {
  location: PropTypes.object,
  app: ImmutablePropTypes.record
}

export default connect(mapStateToProps)(Routes)
