import React from 'react'
import PropTypes from 'prop-types'

import Avatar from '@mui/material/Avatar'

export default function NFLTeamLogo({ abbrv, size = 36 }) {
  const s = size * 2
  const src = `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/${abbrv}.png&h=${s}&w=${
    size * 2
  }`
  const style = { width: size, height: size }
  const classNames = ['nfl__team-logo']
  return <Avatar src={src} className={classNames.join(' ')} style={style} />
}

NFLTeamLogo.propTypes = {
  abbrv: PropTypes.string,
  size: PropTypes.number
}
