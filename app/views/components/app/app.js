import React, { useEffect, useState } from 'react'
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

import 'normalize.css'
import '@simonwep/pickr/dist/themes/nano.min.css'
import '@styles/normalize.css'
import '@styles/index.styl'
import './app.styl'

hotkeys('control+command+w', () => {
  document.body.classList.toggle('hide-watchlist')
})

export default function App({ init, isPending }) {
  const isMobile = window.innerWidth < 800
  const [menu_open, set_menu_open] = useState(!isMobile)
  const match = useMatch('leagues/:leagueId/*')
  const leagueId = match ? Number(match.params.leagueId) || 0 : undefined

  useEffect(() => {
    async function onLoad() {
      const token = await localStorageAdapter.getItem('token')
      init({ token, leagueId })
    }
    onLoad()
  }, [init, leagueId])

  if (isPending) {
    return <Loading loading={isPending} />
  }

  const classNames = []
  if (menu_open) {
    classNames.push('menu__open')
  }

  return (
    <main className={classNames.join(' ')}>
      <Menu {...{ menu_open, set_menu_open }} />
      <Routes />
      <ContextMenu />
      <Confirmation />
      <Notification />
      <SelectedPlayer />
    </main>
  )
}

App.propTypes = {
  init: PropTypes.func,
  isPending: PropTypes.bool
}
