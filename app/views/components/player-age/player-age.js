import React from 'react'
import moment from 'moment'

export default function ({ date }) {
  return (
    <span>
      {(moment().diff(moment(date), 'days') / 365).toFixed(1) || '-'}
    </span>
  )
}
