import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Box from '@mui/material/Box'

import TeamName from '@components/team-name'
import PlayerHeadshot from '@components/player-headshot'

import './draft-pick-item.styl'

export default function DraftPickItem({ player, pick, year, showYear = true }) {
  const pos = player?.get('pos')
  const classNames = ['draft-pick-item']
  if (pos) classNames.push(pos)

  return (
    <Box className={classNames.join(' ')}>
      {showYear && <div className='draft-pick-item-year'>{year}</div>}

      <Box className='draft-pick-item-content'>
        {player?.get('pid') && (
          <>
            <PlayerHeadshot player_map={player} width={48} position={pos} />
            <Box className='draft-pick-item-player'>
              <div className='draft-pick-item-player-last'>
                {player.get('lname')}
              </div>
              <div className='draft-pick-item-player-first'>
                {player.get('fname')}
              </div>
            </Box>
          </>
        )}
        {!player?.get('pid') && (
          <div className='draft-pick-item-empty'>No selection</div>
        )}
      </Box>

      <Box className='draft-pick-item-footer'>
        <TeamName tid={pick.tid} abbrv />
      </Box>
    </Box>
  )
}

DraftPickItem.propTypes = {
  player: ImmutablePropTypes.map,
  pick: PropTypes.object.isRequired,
  year: PropTypes.number.isRequired,
  showYear: PropTypes.bool
}
