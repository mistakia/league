import React from 'react'
import dayjs from 'dayjs'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import Team from '@components/team'
import Position from '@components/position'

import './draft-pick.styl'

export default class DraftPick extends React.Component {
  render() {
    const { player, pick, team, league, isActive, isUser } = this.props

    const pickNum = pick.pick % league.nteams || league.nteams

    const classNames = ['draft__pick']
    if (isActive && !pick.player) {
      classNames.push('active')
    }

    if (isUser) {
      classNames.push('user')
    }

    return (
      <div className={classNames.join(' ')}>
        <div className='draft__pick-num'>
          {pick.round}.{('0' + pickNum).slice(-2)}
        </div>
        <div className='draft__pick-main'>
          {player.player && (
            <div className='draft__pick-player'>
              <span className='draft__pick-player-name'>
                {player.fname} {player.lname}
              </span>
              <Team team={player.team} />
            </div>
          )}
          <div className='draft__pick-team'>{team.name}</div>
          {isActive && !pick.player && (
            <div className='draft__pick-window active'>On the clock</div>
          )}
          {!isActive && !pick.player && Boolean(pick.pick) && (
            <div className='draft__pick-window'>
              On the clock {dayjs().to(pick.draftWindow)}
            </div>
          )}
        </div>
        <div className='draf__pick-pos'>
          <Position pos={player.pos} />
        </div>
      </div>
    )
  }
}

DraftPick.propTypes = {
  player: ImmutablePropTypes.record,
  pick: PropTypes.object,
  team: ImmutablePropTypes.record,
  isActive: PropTypes.bool,
  isUser: PropTypes.bool,
  league: PropTypes.object
}
