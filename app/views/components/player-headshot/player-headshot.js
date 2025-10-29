import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import Avatar from '@mui/material/Avatar'

import { get_player_image_url } from '@core/utils'

import './player-headshot.styl'

export default function PlayerHeadshot({
  player_map,
  width = 48,
  square = false,
  position
}) {
  const height = Math.round((width * 70) / 96)
  const src = get_player_image_url({ player_map, width, height })

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
  player_map: ImmutablePropTypes.map,
  width: PropTypes.number,
  square: PropTypes.bool,
  position: PropTypes.string
}
