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
  const isTeam = playerMap.get('pos') === 'DST'
  const height = Math.round((width * 70) / 96)

  let src
  if (isTeam) {
    const pid = playerMap.get('pid')
    src = `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/${pid}.png&h=${
      height * 2
    }&w=${width * 2}`
  } else {
    const espn_id = playerMap.get('espn_id')
    src = espn_id
      ? `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${espn_id}.png&w=${
          width * 2
        }&h=${height * 2}&cb=1`
      : null
  }

  const classNames = ['player__headshot']
  if (square) classNames.push('square')

  return (
    <Avatar
      src={src}
      className={classNames.join(' ')}
      style={{ width, height: square ? width : height }}
    />
  )
}

PlayerHeadshot.propTypes = {
  playerMap: ImmutablePropTypes.map,
  width: PropTypes.number,
  square: PropTypes.bool
}
