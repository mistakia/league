import React from 'react'
import dayjs from 'dayjs'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import Team from '@components/team'
import Position from '@components/position'
import { getDraftWindow } from '@common'

import './draft-pick.styl'

export default class DraftPick extends React.Component {
  render() {
    const { player, pick, team, league } = this.props

    const pickNum = pick.pick % league.nteams || league.nteams

    const draftWindow = getDraftWindow({
      start: league.ddate,
      pickNum: pick.pick
    })
    const isActive = pick.pick && dayjs().isAfter(draftWindow)

    const classNames = ['draft__pick']
    if (isActive && !pick.player) {
      classNames.push('active')
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
          {!isActive && Boolean(pick.pick) && (
            <div className='draft__pick-window'>
              On the clock {dayjs().to(draftWindow)}
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
  league: PropTypes.object
}
