import React, { lazy } from 'react'
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

const AuthPage = lazy(() => import('@pages/auth'))
const LeagueHomePage = lazy(() => import('@pages/league-home'))
const DraftPage = lazy(() => import('@pages/draft'))
const AuctionPage = lazy(() => import('@pages/auction'))
const PlayersPage = lazy(() => import('@pages/players'))
const PlayersTablePage = lazy(() => import('@pages/players-table'))
const LineupsPage = lazy(() => import('@pages/lineups'))
const TradePage = lazy(() => import('@pages/trade'))
const TeamSettingsPage = lazy(() => import('@pages/team-settings'))
const MarkdownPage = lazy(() => import('@pages/markdown'))
const StatusPage = lazy(() => import('@pages/status'))
const PropsPage = lazy(() => import('@pages/props'))
const TransactionsPage = lazy(() => import('@pages/transactions'))
const StandingsPage = lazy(() => import('@pages/standings'))
const StatsPage = lazy(() => import('@pages/stats'))
const SchedulePage = lazy(() => import('@pages/schedule'))
const RostersPage = lazy(() => import('@pages/rosters'))
const WaiversPage = lazy(() => import('@pages/waivers'))
const TeamPage = lazy(() => import('@pages/team'))
const LeagueSettingsPage = lazy(() => import('@pages/league-settings'))
const MatchupPage = lazy(() => import('@pages/matchup'))
const UserSettingsPage = lazy(() => import('@pages/user-settings'))

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
      return <Navigate to='/leagues/0/players' />
    }
  }

  return (
    <RouterRoutes>
      {!app.userId && <Route path='/login' element={<AuthPage />} />}
      {app.userId && <Route path='/lineups' element={<LineupsPage />} />}
      {app.userId && <Route path='/trade' element={<TradePage />} />}
      <Route path='/leagues/:lid'>
        <Route path='/leagues/:lid/players' element={<PlayersPage />} />
        <Route
          path='/leagues/:lid/players-table'
          element={<PlayersTablePage />}
        />
        <Route path='/leagues/:lid/auction' element={<AuctionPage />} />
        <Route path='/leagues/:lid/draft' element={<DraftPage />} />
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
      <Route path='/settings' element={<UserSettingsPage />} />
      <Route
        path='/leagues/:lid/team-settings'
        element={<TeamSettingsPage />}
      />
      <Route path='/about' element={<MarkdownPage path='/README.md' />} />
      <Route
        path='/resources'
        element={<MarkdownPage path='/resources.md' />}
      />
      <Route path='/glossary' element={<MarkdownPage path='/glossary.md' />} />
      <Route
        path='/guides/players-table'
        element={<MarkdownPage path='/guides/players-table.md' />}
      />
      <Route path='*' element={<UnmatchedRoute />} />
    </RouterRoutes>
  )
}

Routes.propTypes = {
  app: ImmutablePropTypes.record
}

export default connect(mapStateToProps)(Routes)
