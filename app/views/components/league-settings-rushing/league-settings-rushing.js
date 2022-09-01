import React from 'react'
import PropTypes from 'prop-types'

import EditableLeagueField from '@components/editable-league-field'
import SettingsSection from '@components/settings-section'

export default function LeagueSettingsRushing({
  league,
  isCommish,
  isDefault,
  onchange
}) {
  const props = { league, isCommish, isDefault, onchange }
  const title = 'Rushing'
  const description = 'Scoring settings for rushing stats'
  const body = (
    <>
      <EditableLeagueField
        label='Attempts'
        field='ra'
        type='float'
        max={1}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='Yards'
        field='ry'
        type='float'
        max={2}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='Fumbles'
        field='fuml'
        type='int'
        max={0}
        min={-3}
        {...props}
      />
      <EditableLeagueField
        label='Tds'
        field='tdr'
        type='int'
        max={12}
        min={0}
        {...props}
      />
    </>
  )

  return <SettingsSection {...{ body, title, description }} />
}

LeagueSettingsRushing.propTypes = {
  league: PropTypes.object,
  isCommish: PropTypes.bool,
  isDefault: PropTypes.bool,
  onchange: PropTypes.func
}
