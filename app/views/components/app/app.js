import React, { useEffect, useState, Suspense } from 'react'
import { useMatch } from 'react-router-dom'
import PropTypes from 'prop-types'
import hotkeys from 'hotkeys-js'

import Menu from '@components/menu'
import Routes from '@views/routes'
import Loading from '@components/loading'
import ContextMenu from '@components/context-menu'
import { localStorageAdapter } from '@core/utils'
import Confirmation from '@components/confirmation'
import Notification from '@components/notification'
import SelectedPlayer from '@components/selected-player'
import AuctionControls from '@components/auction-controls'
import AuctionCommissionerControls from '@components/auction-commissioner-controls'

import 'normalize.css'
import '@simonwep/pickr/dist/themes/nano.min.css'
import '@styles/normalize.css'
import '@styles/index.styl'
import './app.styl'

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
      <Menu {...{ menu_open, set_menu_open }} />
      <Suspense fallback={<Loading loading />}>
        <Routes />
      </Suspense>
      <ContextMenu />
      <Confirmation />
      <Notification />
      <SelectedPlayer />
      {is_auction_live && <AuctionControls />}
      {is_auction_live && isCommish && is_hosted && (
        <AuctionCommissionerControls />
      )}
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
