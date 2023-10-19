import React, { useState, useEffect } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import NotInterestedIcon from '@mui/icons-material/NotInterested'

import Position from '@components/position'
import NFLTeam from '@components/nfl-team'
import { constants } from '@libs-shared'
import PlayerLabel from '@components/player-label'
import PlayerTag from '@components/player-tag'
import PlayerStatus from '@components/player-status'
import PlayerHeadshot from '@components/player-headshot'

import './player-name.styl'

function PlayerLarge({ playerMap, handleClick, width, square = false }) {
  return (
    <div className='player__name large'>
      <div className='player__name-headshot'>
        <PlayerHeadshot playerMap={playerMap} width={width} square={square} />
      </div>
      <div className='player__name-lead'>
        <div className='player__name-first'>{playerMap.get('fname')}</div>
        <div className='player__name-last'>{playerMap.get('lname')}</div>
        <div className='player__name-meta'>
          <Position pos={playerMap.get('pos')} />
          <NFLTeam team={playerMap.get('team')} />
          <span>#{playerMap.get('jnum', '-')}</span>
        </div>
      </div>
    </div>
  )
}

PlayerLarge.propTypes = {
  playerMap: ImmutablePropTypes.map,
  handleClick: PropTypes.func,
  width: PropTypes.number,
  square: PropTypes.bool
}

export default function PlayerName({
  select,
  playerMap,
  isOnCutlist,
  headshot_width,
  headshot_square,
  hidePosition,
  large
}) {
  const [is_mobile, set_is_mobile] = useState(window.innerWidth < 600)

  useEffect(() => {
    const handleResize = () => {
      set_is_mobile(window.innerWidth < 600)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const handleClick = () => select(playerMap.get('pid'))

  if (large) {
    return (
      <PlayerLarge
        {...{
          playerMap,
          handleClick,
          square: headshot_square,
          width: headshot_width
        }}
      />
    )
  }

  const slot = playerMap.get('slot')

  return (
    <>
      <div className='player__name cursor' onClick={handleClick}>
        {!hidePosition && (
          <div className='player__name-position'>
            <Position pos={playerMap.get('pos')} />
          </div>
        )}
        {Boolean(headshot_width) && (
          <div className='player__name-headshot'>
            <PlayerHeadshot
              playerMap={playerMap}
              width={headshot_width}
              square={headshot_square}
              position={is_mobile ? playerMap.get('pos') : null}
            />
          </div>
        )}
        <div className='player__name-main'>
          <div className='player__name-top'>
            <span>{playerMap.get('pname')}</span>
            {constants.year === playerMap.get('start') && (
              <PlayerLabel label='R' type='rookie' description='Rookie' />
            )}
          </div>
          <NFLTeam team={playerMap.get('team')} />
        </div>
      </div>
      <div className='player__name-label'>
        {(slot === constants.slots.PSP || slot === constants.slots.PSDP) && (
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

PlayerName.propTypes = {
  playerMap: ImmutablePropTypes.map,
  headshot_width: PropTypes.number,
  select: PropTypes.func,
  isOnCutlist: PropTypes.bool,
  headshot_square: PropTypes.bool,
  hidePosition: PropTypes.bool,
  large: PropTypes.bool
}
