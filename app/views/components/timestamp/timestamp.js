import React from 'react'
import PropTypes from 'prop-types'
import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'

import './timestamp.styl'

dayjs.extend(localizedFormat)

export default class Timestamp extends React.Component {
  render = () => {
    const { timestamp } = this.props

    const m = dayjs.unix(timestamp)

    return (
      <div className='timestamp'>
        <div className='timestamp__date'>{m.format('ddd MMM D YYYY')}</div>
        <div className='timestamp__time'>{m.format('LT')}</div>
      </div>
    )
  }
}

Timestamp.propTypes = {
  timestamp: PropTypes.number
}
