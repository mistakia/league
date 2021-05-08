import React from 'react'
import dayjs from 'dayjs'

export default function ({ date }) {
  return (
    <span>{(dayjs().diff(dayjs(date), 'days') / 365).toFixed(1) || '-'}</span>
  )
}
