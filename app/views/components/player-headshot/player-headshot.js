import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import Avatar from '@material-ui/core/Avatar'

import './player-headshot.styl'

export default function PlayerHeadshot({ player, width = 48 }) {
  const height = Math.round((width * 70) / 96)
  const src = player.espn_id
    ? `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${
        player.espn_id
      }.png&w=${width * 2}&h=${height * 2}&cb=1`
    : null

  return (
    <Avatar
      src={src}
      className='player__headshot'
      style={{ width, height: width }}
    />
  )
}

PlayerHeadshot.propTypes = {
  player: ImmutablePropTypes.record,
  width: PropTypes.number
}
