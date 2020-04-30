import React from 'react'
import hotkeys from 'hotkeys-js'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

// import Menu from '@components/menu'
// import Routes from '@views/routes'
import { getApp } from '@core/app'
import Loading from '@components/loading'

import 'normalize.css'
import '@styles/normalize.css'
import '@styles/index.styl'
import './app.styl'

class App extends React.Component {
  constructor (props) {
    super(props)

    // TODO add general keyboard shortcuts

  }

  render () {
    const { isPending } = this.props.app
    if (isPending) {
      return <Loading loading={isPending} />
    }

    return (
      <main>
        <div>Hello World</div>
      </main>
    )
  }
}

const mapStateToProps = createSelector(
  getApp,
  (app) => ({ app })
)

export default connect(mapStateToProps)(App)
