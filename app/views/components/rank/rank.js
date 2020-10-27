import React from 'react'
import { nth } from '@common'

export default class Rank extends React.Component {
  render = () => {
    const { rank, size } = this.props

    const tQuarter = Math.ceil(size / 4)
    const bQuarter = size - tQuarter
    const classNames = []
    if (rank <= tQuarter) classNames.push('text-green')
    else if (rank >= bQuarter) classNames.push('text-red')

    return (
      <span className={classNames.join(' ')}>
        {rank}{nth(rank)}
      </span>
    )
  }
}
