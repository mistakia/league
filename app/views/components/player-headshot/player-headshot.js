import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import Avatar from '@mui/material/Avatar'

import './player-headshot.styl'

export default function PlayerHeadshot({
  playerMap,
  width = 48,
  square = false,
  position
}) {
  const isTeam = playerMap.get('pos') === 'DST'
  const height = Math.round((width * 70) / 96)

  let src
  if (isTeam) {
    const pid = playerMap.get('pid')
    src = `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/${pid}.png&h=${
      height * 2
    }&w=${height * 2}`
  } else {
    const espn_id = playerMap.get('espn_id')
    src = espn_id
      ? `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${espn_id}.png&w=${
          width * 2
        }&h=${height * 2}&cb=1`
      : null
  }

  const classNames = ['player__headshot']
  const style = {
    width: square ? height : width,
    height
  }

  if (square) {
    classNames.push('square')
  }

  if (position) {
    classNames.push(position)
  }

  if (square) {
    const diff = Math.round((width - height) / 2)
    style.margin = `0 ${diff}px`
  }

  return <Avatar src={src} className={classNames.join(' ')} style={style} />
}

PlayerHeadshot.propTypes = {
  playerMap: ImmutablePropTypes.map,
  width: PropTypes.number,
  square: PropTypes.bool,
  position: PropTypes.string
}
