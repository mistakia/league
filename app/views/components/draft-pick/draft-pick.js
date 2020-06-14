import React from 'react'

import './draft-pick.styl'

export default class DraftPick extends React.Component {
  render () {
    const { player, pick, team, league, isActive } = this.props

    const round = pick.round
    const pickNum = (pick.pick % league.nteams) || league.nteams

    const classNames = ['draft__pick']
    if (isActive) {
      classNames.push('active')
    }

    return (
      <div className={classNames.join(' ')}>
        <div className='draft__pick-num'>
          {round}.{('0' + pickNum).slice(-2)}
        </div>
        <div className='draft__pick-main'>
          <div className='draft__pick-player'>{player.fname} {player.lname}</div>
          <div className='draft__pick-team'>{team.name}</div>
        </div>
      </div>
    )
  }
}
