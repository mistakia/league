import React from 'react'

import Team from '@components/team'
import Position from '@components/position'

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
          {player.player && <div className='draft__pick-player'>
            <span className='draft__pick-player-name'>{player.fname} {player.lname}</span>
            <Team team={player.team} />
          </div>}
          {isActive && <div className='draft__pick-active'>On the clock</div>}
          <div className='draft__pick-team'>{team.name}</div>
        </div>
        <div className='draf__pick-pos'>
          <Position pos={player.pos1} />
        </div>
      </div>
    )
  }
}
