import React from 'react'

import render from './league'

class LeaguePage extends React.Component {
  render () {
    return render.call(this)
  }
}

export default LeaguePage
