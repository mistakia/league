import React, { useEffect } from 'react'
import { useMatch } from 'react-router-dom'
import PropTypes from 'prop-types'
import Backdrop from '@mui/material/Backdrop'
import CircularProgress from '@mui/material/CircularProgress'
// import hotkeys from 'hotkeys-js'

import Menu from '@components/menu'
import Routes from '@views/routes'
import Loading from '@components/loading'
import ContextMenu from '@components/context-menu'
import { localStorageAdapter } from '@core/utils'
import Logout from '@components/logout'
import Confirmation from '@components/confirmation'
import Notification from '@components/notification'
import SelectedPlayer from '@components/selected-player'

import 'normalize.css'
import '@simonwep/pickr/dist/themes/nano.min.css'
import '@styles/normalize.css'
import '@styles/index.styl'
import './app.styl'

export default function App({ init, isPending, userId, isInitializing }) {
  const match = useMatch('leagues/:leagueId/*')
  const leagueId = match ? Number(match.params.leagueId) : undefined

  useEffect(() => {
    async function onLoad() {
      const token = await localStorageAdapter.getItem('token')
      init({ token, leagueId })
    }
    onLoad()
  }, [])

  if (isPending) {
    return <Loading loading={isPending} />
  }

  return (
    <main>
      <Backdrop
        classes={{ root: 'initializing__backdrop' }}
        open={isInitializing}
      >
        <CircularProgress color='inherit' />
      </Backdrop>
      <Menu />
      <Routes />
      {userId && <Logout />}
      <ContextMenu />
      <Confirmation />
      <Notification />
      <SelectedPlayer />
    </main>
  )
}

App.propTypes = {
  init: PropTypes.func,
  isPending: PropTypes.bool,
  userId: PropTypes.number,
  isInitializing: PropTypes.bool
}
