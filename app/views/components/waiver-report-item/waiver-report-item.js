import React from 'react'

import PlayerName from '@components/player-name'
import TeamName from '@components/team-name'

import './waiver-report-item.styl'

function AlternateClaims ({ waivers }) {
  if (!waivers.length) {
    return null
  }

  const items = []
  for (const [index, item] of waivers.entries()) {
    items.push(
      <div className='table__row' key={index}>
        <div className='table__cell metric'>${item.bid}</div>
        <div className='table__cell'>
          <TeamName tid={item.tid} />
        </div>
        <div className='table__cell reason'>
          {item.reason}
        </div>
      </div>
    )
  }

  return (
    <div className='table__container'>
      <div className='table__head table__row'>
        <div className='table__cell'>Bid</div>
        <div className='table__cell'>Team</div>
        <div className='table__cell'>Reason</div>
      </div>
      {items}
    </div>
  )
}

export default class WaiverReportItem extends React.Component {
  render = () => {
    const { waiver } = this.props

    return (
      <div className='waiver__report-item'>
        <div className='waiver__report-item-head'>
          <TeamName tid={waiver.tid} />
          <div className='waiver__report-item-winning-bid metric'>${waiver.bid}</div>
        </div>
        <PlayerName playerId={waiver.player} hideActions />
        <AlternateClaims waivers={waiver.waivers} />
      </div>
    )
  }
}
