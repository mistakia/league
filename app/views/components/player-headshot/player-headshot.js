import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

export default function PlayerHeadshot({ player }) {
  const height = 32
  const width = 43
  const src = `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${player.espn_id}.png&w=96&h=70&cb=1`
  const nomug = `https://a.espncdn.com/combiner/i?img=/games/lm-static/ffl/images/nomug.png&w=${width}&h=${height}&cb=1`

  const onError = (ev) => {
    if (ev.target.src === nomug) {
      ev.target.style.display = 'none'
      return
    }
    ev.target.src = nomug
  }
  return (
    <img
      width={`${width}px`}
      height={`${height}px`}
      src={player.espn_id ? src : nomug}
      onError={onError}
    />
  )
}

PlayerHeadshot.propTypes = {
  player: ImmutablePropTypes.record
}
