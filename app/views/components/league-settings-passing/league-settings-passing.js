import React from 'react'
import PropTypes from 'prop-types'

import EditableLeagueField from '@components/editable-league-field'
import SettingsSection from '@components/settings-section'

export default function LeagueSettingsPassing({
  league,
  isCommish,
  isDefault,
  onchange
}) {
  const props = { league, isCommish, isDefault, onchange }
  const title = 'Passing'
  const description = 'Scoring settings for passing stats'
  const body = (
    <>
      <EditableLeagueField
        label='Attempts'
        field='pa'
        type='float'
        max={2}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='Completions'
        field='pc'
        type='float'
        max={2}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='Yards'
        field='py'
        type='float'
        max={1}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='Ints'
        field='ints'
        type='int'
        max={0}
        min={-3}
        {...props}
      />
      <EditableLeagueField
        label='Tds'
        field='tdp'
        type='int'
        max={12}
        min={0}
        {...props}
      />
    </>
  )

  return <SettingsSection {...{ body, title, description }} />
}

LeagueSettingsPassing.propTypes = {
  league: PropTypes.object,
  isCommish: PropTypes.bool,
  isDefault: PropTypes.bool,
  onchange: PropTypes.func
}
