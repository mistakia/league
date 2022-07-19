import React from 'react'
import dayjs from 'dayjs'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import TeamName from '@components/team-name'

import './draft-pick.styl'

export default class DraftPick extends React.Component {
  render() {
    const { playerMap, pick, team, league, isActive, isUser } = this.props

    const pickNum = pick.pick % league.nteams || league.nteams

    const classNames = ['draft__pick']
    if (isActive && !pick.pid) {
      classNames.push('active')
    }

    if (isUser) {
      classNames.push('user')
    }

    const pos = playerMap.get('pos')
    if (pos) classNames.push(pos)

    return (
      <div className={classNames.join(' ')}>
        <div className='draft__pick-num'>
          {pick.round}.{('0' + pickNum).slice(-2)}
        </div>
        <div className='draft__pick-main'>
          {Boolean(playerMap.get('pid')) && (
            <div className='draft__pick-player'>
              <div className='draft__pick-player-name'>
                {playerMap.get('lname')}
              </div>
              <div className='draft__pick-player-name'>
                {playerMap.get('fname')}
              </div>
            </div>
          )}
          {isActive && !pick.pid && (
            <div className='draft__pick-window active'>On the clock</div>
          )}
          {!isActive &&
            !pick.pid &&
            Boolean(pick.pick) &&
            Boolean(pick.draftWindow) && (
              <div className='draft__pick-window'>
                {dayjs().to(pick.draftWindow)}
              </div>
            )}
          <div className='draft__pick-team'>
            <TeamName tid={team.uid} abbrv />
          </div>
        </div>
      </div>
    )
  }
}

DraftPick.propTypes = {
  playerMap: ImmutablePropTypes.map,
  pick: PropTypes.object,
  team: ImmutablePropTypes.record,
  isActive: PropTypes.bool,
  isUser: PropTypes.bool,
  league: PropTypes.object
}
