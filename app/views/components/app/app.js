import React from 'react'
// import hotkeys from 'hotkeys-js'

import Menu from '@components/menu'
import Routes from '@views/routes'
import Loading from '@components/loading'
import ContextMenu from '@components/context-menu'
import { localStorageAdapter } from '@core/utils'
import Logout from '@components/logout'
import Confirmation from '@components/confirmation'
import Notification from '@components/notification'

import 'normalize.css'
import '@styles/normalize.css'
import '@styles/index.styl'
import './app.styl'

class App extends React.Component {
  async componentDidMount () {
    const token = await localStorageAdapter.getItem('token')
    const key = await localStorageAdapter.getItem('key')
    this.props.init({ token, key })

    window.addEventListener('error', (error) => this.props.report(error), true)
    window.addEventListener('unhandledrejection', (error) => this.props.report(error), true)
  }

  render () {
    const { isPending, userId } = this.props
    if (isPending) {
      return <Loading loading={isPending} />
    }

    return (
      <main>
        <Menu />
        <Routes />
        {userId && <Logout />}
        <ContextMenu />
        <Confirmation />
        <Notification />
      </main>
    )
  }
}

export default App
