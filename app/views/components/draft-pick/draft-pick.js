import React from 'react'

import './draft-pick.styl'

export default class DraftPick extends React.Component {
  render () {
    const { player, pick, team, league } = this.props

    const round = pick.round
    const pickNum = (pick.pick % league.nteams) || league.nteams

    return (
      <div className='draft__pick'>
        <div className='draft__pick-num'>
          {round}.{('0' + pickNum).slice(-2)}
        </div>
        <div className='draft__pick-main'>
          <div className='draft__pick-player'></div>
          <div className='draft__pick-team'>{team.name}</div>
        </div>
      </div>
    )
  }
}
