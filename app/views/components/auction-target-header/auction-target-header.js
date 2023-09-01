import React from 'react'
import PropTypes from 'prop-types'
import Tooltip from '@mui/material/Tooltip'

import Position from '@components/position'

import './auction-target-header.styl'

export default class AuctionTargetHeader extends React.Component {
  render = () => {
    const { info, pos } = this.props

    const inflation =
      info.value.actual && info.value.retail
        ? (info.value.retail / info.value.actual || 0) * 100 - 100
        : 0

    const positive = inflation >= 0
    const has_position = Boolean(pos)
    const positive_text = `A positive value indicates rostered player salaries ${
      has_position ? 'at this position' : ''
    } are below market salaries.`
    const negative_text = `A negative value indicates rostered player salaries ${
      has_position ? 'at this position' : ''
    } are above market salaries.`

    return (
      <div className='auction__target-header'>
        {has_position && <Position pos={pos} />}
        <div className='auction__target-header-scarcity'>
          <Tooltip title='Positional Value Remaining' placement='bottom'>
            <span>
              {(
                100 -
                (info.pts_added.rostered / info.pts_added.total || 0) * 100
              ).toFixed(1)}
              %
            </span>
          </Tooltip>
        </div>
        <div className='auction__target-header-count'>
          <Tooltip title='Positional Rostered Count' placement='bottom'>
            <span>
              {info.count.rostered}/{info.count.total}
            </span>
          </Tooltip>
        </div>
        <div className='auction__target-header-bye'>
          <Tooltip title='Bye Week' placement='bottom'>
            <span>BW</span>
          </Tooltip>
        </div>
        <div className='auction__target-header-inflation'>
          <Tooltip
            title={`Positional Salary Inflation. ${
              positive ? positive_text : negative_text
            }`}
            placement='bottom'
          >
            <span>
              {positive ? '+' : null}
              {inflation.toFixed(1)}%
            </span>
          </Tooltip>
        </div>
      </div>
    )
  }
}

AuctionTargetHeader.propTypes = {
  info: PropTypes.object,
  pos: PropTypes.string
}
