import React, { useState, useEffect } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import NotInterestedIcon from '@mui/icons-material/NotInterested'

import Position from '@components/position'
import NFLTeam from '@components/nfl-team'
import { constants } from '@libs-shared'
import PlayerLabel from '@components/player-label'
import PlayerTag from '@components/player-tag'
import { get_reserve_eligibility_from_player_map } from '@libs-shared'
import PlayerStatus from '@components/player-status'
import PlayerHeadshot from '@components/player-headshot'

import './player-name.styl'

function PlayerLarge({ player_map, handleClick, width, square = false }) {
  const player_number = player_map.get('jnum')
  return (
    <div className='player__name large'>
      <div className='player__name-headshot'>
        <PlayerHeadshot player_map={player_map} width={width} square={square} />
      </div>
      <div className='player__name-lead'>
        <div className='player__name-first'>{player_map.get('fname')}</div>
        <div className='player__name-last'>{player_map.get('lname')}</div>
        <div className='player__name-meta'>
          <Position pos={player_map.get('pos')} />
          <NFLTeam team={player_map.get('team')} />
          {Boolean(player_number) && <span>#{player_number}</span>}
        </div>
      </div>
    </div>
  )
}

PlayerLarge.propTypes = {
  player_map: ImmutablePropTypes.map,
  handleClick: PropTypes.func,
  width: PropTypes.number,
  square: PropTypes.bool
}

export default function PlayerName({
  select,
  player_map,
  isOnCutlist,
  headshot_width,
  headshot_square,
  hidePosition,
  large,
  show_position_bar,
  show_reserve_tag = false
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

  const handleClick = () => select(player_map.get('pid'))

  if (large) {
    return (
      <PlayerLarge
        {...{
          player_map,
          handleClick,
          square: headshot_square,
          width: headshot_width
        }}
      />
    )
  }

  const slot = player_map.get('slot')
  const reserve_info = get_reserve_eligibility_from_player_map({ player_map })
  const reserve_eligible = show_reserve_tag
    ? Boolean(reserve_info.reserve_short_term_eligible || reserve_info.cov)
    : false

  return (
    <>
      <div className='player__name cursor' onClick={handleClick}>
        {!hidePosition && (
          <div className='player__name-position'>
            <Position pos={player_map.get('pos')} />
          </div>
        )}
        {Boolean(headshot_width) && (
          <div className='player__name-headshot'>
            <PlayerHeadshot
              player_map={player_map}
              width={headshot_width}
              square={headshot_square}
              position={
                show_position_bar && is_mobile ? player_map.get('pos') : null
              }
            />
          </div>
        )}
        <div className='player__name-main'>
          <div className='player__name-top'>
            <span>{player_map.get('pname')}</span>
            {constants.year === player_map.get('nfl_draft_year') && (
              <PlayerLabel label='R' type='rookie' description='Rookie' />
            )}
          </div>
          <NFLTeam team={player_map.get('team')} />
        </div>
      </div>
      <div className='player__name-label'>
        {(slot === constants.slots.PSP || slot === constants.slots.PSDP) && (
          <PlayerLabel label='P' description='Protected Practice Squad' />
        )}
        {isOnCutlist && (
          <PlayerLabel label={<NotInterestedIcon />} description='Cutlist' />
        )}
        <PlayerStatus player_map={player_map} />
        <PlayerTag
          tag={player_map.get('tag')}
          reserve_eligible={reserve_eligible}
        />
      </div>
    </>
  )
}

PlayerName.propTypes = {
  player_map: ImmutablePropTypes.map,
  headshot_width: PropTypes.number,
  select: PropTypes.func,
  isOnCutlist: PropTypes.bool,
  headshot_square: PropTypes.bool,
  hidePosition: PropTypes.bool,
  large: PropTypes.bool,
  show_position_bar: PropTypes.bool
}
