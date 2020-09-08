import React from 'react'
import Backdrop from '@material-ui/core/Backdrop'
import CircularProgress from '@material-ui/core/CircularProgress'
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

class App extends React.Component {
  async componentDidMount () {
    const token = await localStorageAdapter.getItem('token')
    const key = await localStorageAdapter.getItem('key')
    this.props.init({ token, key })
  }

  render () {
    const { isPending, userId, isInitializing } = this.props
    if (isPending) {
      return <Loading loading={isPending} />
    }

    return (
      <main>
        <Backdrop classes={{ root: 'initializing__backdrop' }} open={isInitializing}>
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
}

export default App
