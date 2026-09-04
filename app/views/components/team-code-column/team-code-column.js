import React from 'react'
import PropTypes from 'prop-types'

import NFLTeamLogo from '@components/nfl-team-logo'

import './team-code-column.styl'

// `empty_team_label` is what the cell shows when the row names no team. It has
// no default on purpose: "FA" is a fantasy free-agency reading of an absent
// team, true of a player row and false of a play, which has no possession team
// on a timeout or a penalty rather than a team that is a free agent. Callers
// that mean free agency say so; everyone else renders blank.
export default function TeamCodeColumn({ value, empty_team_label }) {
  const teams = Array.isArray(value)
    ? value.filter(Boolean)
    : value
      ? [value]
      : []

  if (!teams.length || (teams.length === 1 && teams[0] === 'INA')) {
    return <div className='team-code-column'>{empty_team_label}</div>
  }

  if (teams.length === 1) {
    return (
      <div className='team-code-column'>
        <NFLTeamLogo abbrv={teams[0]} size={18} />
        <span className='team-code-column__label'>{teams[0]}</span>
      </div>
    )
  }

  return (
    <div className='team-code-column team-code-column--multi'>
      <div className='team-code-column__logos'>
        {teams.map((abbrv, i) => (
          <NFLTeamLogo key={`${abbrv}-${i}`} abbrv={abbrv} size={18} />
        ))}
      </div>
      <span className='team-code-column__label'>{teams.join(', ')}</span>
    </div>
  )
}

TeamCodeColumn.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
  empty_team_label: PropTypes.string
}
