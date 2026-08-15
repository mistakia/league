import React, { useEffect, useState, Suspense, lazy } from 'react'
import { useMatch } from 'react-router-dom'
import PropTypes from 'prop-types'
import hotkeys from 'hotkeys-js'

import Menu from '@components/menu'
import PageHead from '@components/page-head'
import LeaguePauseNotice from '@components/league-pause-notice'
import Routes from '@views/routes'
import Loading from '@components/loading'
import ContextMenu from '@components/context-menu'
import { localStorageAdapter } from '@core/utils'

import 'normalize.css'
import '@simonwep/pickr/dist/themes/nano.min.css'
import '@styles/normalize.css'
import '@styles/index.styl'
import './app.styl'

const Confirmation = lazy(() => import('@components/confirmation'))
const Notification = lazy(() => import('@components/notification'))
const SelectedPlayer = lazy(() => import('@components/selected-player'))
const AuctionControls = lazy(() => import('@components/auction-controls'))
const AuctionCommissionerControls = lazy(
  () => import('@components/auction-commissioner-controls')
)

hotkeys('control+command+w', () => {
  document.body.classList.toggle('hide-watchlist')
})

export default function App({
  init,
  isPending,
  isCommish,
  is_hosted,
  is_auction_live,
  is_logged_in
}) {
  const isMobile = window.innerWidth < 800
  const [menu_open, set_menu_open] = useState(!isMobile)
  const match = useMatch('leagues/:leagueId/*')

  useEffect(() => {
    async function onLoad() {
      const leagueId = match ? Number(match.params.leagueId) || 0 : undefined
      const token = await localStorageAdapter.getItem('token')
      init({ token, leagueId })
    }
    onLoad()
  }, [init]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isPending) {
    return <Loading loading={isPending} />
  }

  const classNames = []
  if (menu_open) {
    classNames.push('menu__open')
  }

  // TODO allow non logged in users to follow the auction
  if (is_auction_live && is_logged_in) {
    classNames.push('auction__live')
  }

  return (
    <main className={classNames.join(' ')}>
      {/* Renders nothing. Keeps the document title and meta tags in step with
          the route after a client-side navigation, which never reaches the
          server that filled them for the initial load. */}
      <PageHead />
      <Menu {...{ menu_open, set_menu_open }} />
      {/* A sibling of <Routes /> rather than inside the league routes: this is
          the only every-route surface, since the parent <Route
          path='/leagues/:lid'> has no element of its own. A pause blocks every
          write in the league, so a member who navigates away must not lose the
          explanation for why nothing lands. */}
      <LeaguePauseNotice />
      <Suspense fallback={<Loading loading />}>
        <Routes />
      </Suspense>
      <ContextMenu />
      <Suspense fallback={null}>
        <Confirmation />
        <Notification />
        <SelectedPlayer />
        {is_auction_live && <AuctionControls />}
        {is_auction_live && isCommish && is_hosted && (
          <AuctionCommissionerControls />
        )}
      </Suspense>
    </main>
  )
}

App.propTypes = {
  init: PropTypes.func,
  isPending: PropTypes.bool,
  isCommish: PropTypes.bool,
  is_hosted: PropTypes.bool,
  is_auction_live: PropTypes.bool,
  is_logged_in: PropTypes.bool
}
