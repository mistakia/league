import React from 'react'
import moment from 'moment'

import './timestamp.styl'

export default class Timestamp extends React.Component {
  render = () => {
    const { timestamp } = this.props

    const m = moment(timestamp, 'X')

    return (
      <div className='timestamp'>
        <div className='timestamp__date'>{m.format('ddd MMM D YYYY')}</div>
        <div className='timestamp__time'>{m.format('LT')}</div>
      </div>
    )
  }
}
