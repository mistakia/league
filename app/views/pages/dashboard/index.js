import React from 'react'

import render from './dashboard'

class DashboardPage extends React.Component {
  render () {
    return render.call(this)
  }
}

export default DashboardPage
