import React from 'react'
import PropTypes from 'prop-types'
import dayjs from 'dayjs'

export default function PlayerAge({ date }) {
  if (!date || date === '0000-00-00') {
    return <span>-</span>
  }

  return (
    <span>{(dayjs().diff(dayjs(date), 'days') / 365).toFixed(1) || '-'}</span>
  )
}

PlayerAge.propTypes = {
  date: PropTypes.string
}
