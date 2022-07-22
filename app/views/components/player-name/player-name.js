import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import NotInterestedIcon from '@mui/icons-material/NotInterested'

import Position from '@components/position'
import Team from '@components/team'
import { constants } from '@common'
import PlayerLabel from '@components/player-label'
import PlayerTag from '@components/player-tag'
import PlayerStatus from '@components/player-status'
import PlayerHeadshot from '@components/player-headshot'

import './player-name.styl'

export default class PlayerName extends React.Component {
  handleClick = () => {
    this.props.select(this.props.playerMap.get('pid'))
  }

  render = () => {
    const { playerMap, isOnCutlist, headshot } = this.props

    return (
      <>
        <div className='player__name cursor' onClick={this.handleClick}>
          <div className='player__name-position'>
            <Position pos={playerMap.get('pos')} />
          </div>
          {Boolean(headshot) && (
            <div className='player__name-headshot'>
              <PlayerHeadshot playerMap={playerMap} width={48} />
            </div>
          )}
          <div className='player__name-main'>
            <span>{playerMap.get('pname')}</span>
            {constants.season.year === playerMap.get('start') && (
              <PlayerLabel label='R' type='rookie' description='Rookie' />
            )}
            <Team team={playerMap.get('team')} />
          </div>
        </div>
        <div className='player__name-label'>
          {playerMap.get('slot') === constants.slots.PSP && (
            <PlayerLabel label='P' description='Protected Practice Squad' />
          )}
          {isOnCutlist && (
            <PlayerLabel label={<NotInterestedIcon />} description='Cutlist' />
          )}
          <PlayerStatus playerMap={playerMap} />
          <PlayerTag tag={playerMap.get('tag')} />
        </div>
      </>
    )
  }
}

PlayerName.propTypes = {
  playerMap: ImmutablePropTypes.map,
  headshot: PropTypes.bool,
  select: PropTypes.func,
  isOnCutlist: PropTypes.bool
}
