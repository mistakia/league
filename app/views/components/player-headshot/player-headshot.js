import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import Avatar from '@mui/material/Avatar'

import './player-headshot.styl'

export default function PlayerHeadshot({
  playerMap,
  width = 48,
  square = false
}) {
  const height = Math.round((width * 70) / 96)
  const espn_id = playerMap.get('espn_id')
  const src = espn_id
    ? `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${espn_id}.png&w=${
        width * 2
      }&h=${height * 2}&cb=1`
    : null

  return (
    <Avatar
      src={src}
      className='player__headshot'
      style={{ width, height: square ? width : height }}
    />
  )
}

PlayerHeadshot.propTypes = {
  playerMap: ImmutablePropTypes.map,
  width: PropTypes.number,
  square: PropTypes.bool
}
