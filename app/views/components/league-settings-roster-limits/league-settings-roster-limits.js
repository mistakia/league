import React from 'react'
import PropTypes from 'prop-types'

import EditableLeagueField from '@components/editable-league-field'
import SettingsSection from '@components/settings-section'

export default function LeagueSettingsRosterLimits({
  league,
  isCommish,
  isDefault,
  onchange
}) {
  const props = { league, isCommish, isDefault, onchange }
  const title = 'Roster Limits'
  const description = ''
  const body = (
    <>
      <EditableLeagueField
        label='QB'
        field='mqb'
        type='int'
        max={7}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='RB'
        field='mrb'
        type='int'
        max={20}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='WR'
        field='mwr'
        type='int'
        max={20}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='TE'
        field='mte'
        type='int'
        max={10}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='K'
        field='mk'
        type='int'
        max={5}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='DST'
        field='mdst'
        type='int'
        max={4}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='Bench'
        field='bench'
        type='int'
        max={20}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='PS'
        field='ps'
        type='int'
        max={10}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='Short Term Reserve Limit'
        field='reserve_short_term_limit'
        type='int'
        max={99}
        min={0}
        {...props}
      />
    </>
  )

  return <SettingsSection {...{ body, title, description }} />
}

LeagueSettingsRosterLimits.propTypes = {
  league: PropTypes.object,
  isCommish: PropTypes.bool,
  isDefault: PropTypes.bool,
  onchange: PropTypes.func
}
