/* global IS_DEV */
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
const ForgotPasswordPage = lazy(() => import('@pages/forgot-password'))
const ResetPasswordPage = lazy(() => import('@pages/reset-password'))
const LeagueHomePage = lazy(() => import('@pages/league-home'))
const DraftPage = lazy(() => import('@pages/draft'))
const AuctionPage = lazy(() => import('@pages/auction'))
const PlayersPage = lazy(() => import('@pages/players'))
const DataViewsPage = lazy(() => import('@pages/data-views'))
const PlaysPage = lazy(() => import('@pages/plays'))
const LineupsPage = lazy(() => import('@pages/lineups'))
const TradePage = lazy(() => import('@pages/trade'))
const TeamSettingsPage = lazy(() => import('@pages/team-settings'))
const MarkdownPage = lazy(() => import('@pages/markdown'))
const StatusPage = lazy(() => import('@pages/status'))
const TransactionsPage = lazy(() => import('@pages/transactions'))
const StandingsPage = lazy(() => import('@pages/standings'))
const StatsPage = lazy(() => import('@pages/stats'))
const SchedulePage = lazy(() => import('@pages/schedule'))
const RostersPage = lazy(() => import('@pages/rosters'))
const WaiversPage = lazy(() => import('@pages/waivers'))
const RestrictedFreeAgencyPage = lazy(
  () => import('@pages/restricted-free-agency')
)
const TradeReviewPage = lazy(() => import('@pages/trade-review'))
const TeamPage = lazy(() => import('@pages/team'))
const LeagueSettingsPage = lazy(() => import('@pages/league-settings'))
const MatchupPage = lazy(() => import('@pages/matchup'))
const UserSettingsPage = lazy(() => import('@pages/user-settings'))
const ErrorTest = lazy(() => import('@components/error-test'))
const ShortUrlResolverPage = lazy(() => import('@pages/short-url-resolver'))
const LandingPage = lazy(() => import('@pages/landing'))
const WaitlistPage = lazy(() => import('@pages/waitlist'))
const WaitlistSubmissionsPage = lazy(
  () => import('@pages/waitlist-submissions')
)
const AdmissionVotePage = lazy(() => import('@pages/admission-vote'))
const AdmissionVoteCommissionerPage = lazy(
  () => import('@pages/admission-vote-commissioner')
)

const map_state_to_props = createSelector(get_app, (app) => ({ app }))

const Routes = ({ app }) => {
  const location = useLocation()
  const UnmatchedRoute = () => {
    const { leagueId, teamId } = queryString.parse(location.search)

    if (app.leagueId) {
      return <Navigate to={`/leagues/${app.leagueId}`} />
    } else if (leagueId || teamId) {
      return <Navigate to={`/login${location.search}`} />
    } else {
      return <Navigate to='/data-views' />
    }
  }

  // The front door. Anonymous visitors get the league pitch; a member with a
  // league already connected has no use for it and goes straight to their
  // league, matching what UnmatchedRoute does for every other unknown path.
  const RootRoute = () => {
    // Gated on the session, not just the connected league: an anonymous
    // visitor picks up a league id by browsing into one, and the pitch has to
    // stay reachable at / after they have looked around.
    if (app.userId && app.leagueId) {
      return <Navigate to={`/leagues/${app.leagueId}`} replace />
    }

    return <LandingPage />
  }

  return (
    <RouterRoutes>
      <Route path='/' element={<RootRoute />} />
      {!app.userId && <Route path='/login' element={<AuthPage />} />}
      {/* Both halves of the reset flow are for users who cannot log in, so
          neither is gated on userId — unlike /login, which is hidden once a
          session exists. */}
      <Route path='/forgot-password' element={<ForgotPasswordPage />} />
      {/* Reached from an emailed link, so it is deliberately NOT gated on
          userId — a locked-out user has no session, and the token in the
          query string is the only credential the page needs. */}
      <Route path='/reset-password' element={<ResetPasswordPage />} />
      {app.userId && <Route path='/lineups' element={<LineupsPage />} />}
      {app.userId && <Route path='/trade' element={<TradePage />} />}
      {/* The questionnaire is for people with no account, so it is not gated
          on userId — the whole point is that a stranger can reach it from the
          landing page. */}
      <Route path='/waitlist' element={<WaitlistPage />} />
      <Route path='/data-views' element={<DataViewsPage />} />
      <Route path='/data-views/:view_id' element={<DataViewsPage />} />
      <Route path='/plays' element={<PlaysPage />} />
      <Route path='/plays/:view_id' element={<PlaysPage />} />
      {IS_DEV && <Route path='/error-test' element={<ErrorTest />} />}
      <Route path='/leagues/:lid'>
        <Route path='/leagues/:lid/players' element={<PlayersPage />} />
        <Route
          path='/leagues/:lid/players-table'
          element={<Navigate to={`/data-views${location.search}`} replace />}
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
        <Route
          path='/leagues/:lid/restricted-free-agency'
          element={<RestrictedFreeAgencyPage />}
        />
        <Route
          path='/leagues/:lid/restricted-free-agency/:season_year'
          element={<RestrictedFreeAgencyPage />}
        />
        <Route path='/leagues/:lid/trades' element={<TradeReviewPage />} />
        <Route
          path='/leagues/:lid/trades/:trade_uid'
          element={<TradeReviewPage />}
        />
        {/* Candidate PII. The API refuses anyone who does not manage a team
            in this league, so this route being reachable renders an error
            rather than the applications. */}
        <Route
          path='/leagues/:lid/waitlist-submissions'
          element={<WaitlistSubmissionsPage />}
        />
        {/* Confidential ballots. The API refuses anyone who does not manage a
            team in this league, and discloses nothing at all while the vote is
            open, so this route being reachable renders neither. */}
        {/* The exact path must precede the :param patterns above it in
            page-routes.mjs for the same first-match reason; here react-router
            ranks the more specific path itself. */}
        <Route
          path='/leagues/:lid/admission-vote/commissioner'
          element={<AdmissionVoteCommissionerPage />}
        />
        <Route
          path='/leagues/:lid/admission-vote'
          element={<AdmissionVotePage />}
        />
        <Route path='/leagues/:lid/settings' element={<LeagueSettingsPage />} />
        <Route path='/leagues/:lid' element={<LeagueHomePage />} />
      </Route>
      <Route path='/status' element={<StatusPage />} />
      <Route path='/settings' element={<UserSettingsPage />} />
      <Route
        path='/leagues/:lid/team-settings'
        element={<TeamSettingsPage />}
      />
      {/* The repo README, rendered as a page. 1dc9c4fee redirected this to the
          landing page on the argument that the README is written for
          contributors rather than for a prospective manager; the two are
          different audiences and the landing page serves the second, so this
          serves the first rather than being folded into it. */}
      <Route path='/about' element={<MarkdownPage path='/README.md' />} />
      <Route
        path='/resources'
        element={<MarkdownPage path='/resources.md' />}
      />
      <Route path='/glossary' element={<MarkdownPage path='/glossary.md' />} />
      <Route
        path='/constitution'
        element={<MarkdownPage path='/constitution.md' />}
      />
      <Route
        path='/guides/data-views'
        element={<MarkdownPage path='/guides/data-views.md' />}
      />
      <Route path='/u/:hash' element={<ShortUrlResolverPage />} />
      <Route path='*' element={<UnmatchedRoute />} />
    </RouterRoutes>
  )
}

Routes.propTypes = {
  app: ImmutablePropTypes.record
}

export default connect(map_state_to_props)(Routes)
