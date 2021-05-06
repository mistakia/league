import React from 'react'
import Tooltip from '@material-ui/core/Tooltip'

import './auction-target-header.styl'

export default class AuctionTargetHeader extends React.Component {
  render = () => {
    const { info } = this.props

    const inflation =
      info.value.actual && info.value.retail
        ? (info.value.retail / info.value.actual || 0) * 100 - 100
        : 0

    const positive = inflation >= 0

    return (
      <div className='auction__target-header'>
        <div className='auction__target-header-scarcity'>
          <Tooltip title='Positional Value Remaining' placement='bottom'>
            <span>
              {(
                100 -
                (info.vorp.rostered / info.vorp.total || 0) * 100
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
          <Tooltip title='Positional Salary Inflation' placement='bottom'>
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
