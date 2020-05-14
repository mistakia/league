import React from 'react'

import render from './schedule'

class SchedulePage extends React.Component {
  render () {
    return render.call(this)
  }
}

export default SchedulePage
