import React from 'react'
import PropTypes from 'prop-types'

import NFLTeamLogo from '@components/nfl-team-logo'

import './player-row-nfl-team.styl'

export default function PlayerRowNFLTeam({ row, value }) {
  const team = value || row.original.team
  const teams = Array.isArray(team) ? team : [team]

  let body
  if (!team || team === 'INA') {
    body = 'FA'
  } else if (teams.length > 1) {
    body = <span>{teams.join(', ')}</span>
  } else {
    body = (
      <>
        <NFLTeamLogo abbrv={team} size={24} />
        <span>{team}</span>
      </>
    )
  }

  return <div className='player-row-nfl-team'>{body}</div>
}

PlayerRowNFLTeam.propTypes = {
  row: PropTypes.object.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.array])
}
