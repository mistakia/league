import React from 'react'

import render from './stats'

class StatsPage extends React.Component {
  render () {
    return render.call(this)
  }
}

export default StatsPage
