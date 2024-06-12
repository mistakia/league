import React from 'react'
import PropTypes from 'prop-types'

import NFLTeamLogo from '@components/nfl-team-logo'

import './player-row-nfl-team.styl'

export default function PlayerRowNFLTeam({ row }) {
  const { team } = row.original
  const body =
    !team || team === 'INA' ? 'FA' : <NFLTeamLogo abbrv={team} size={24} />
  return <div className='player-row-nfl-team'>{body}</div>
}

PlayerRowNFLTeam.propTypes = {
  row: PropTypes.object.isRequired
}
