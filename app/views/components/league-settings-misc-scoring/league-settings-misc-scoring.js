import React from 'react'
import PropTypes from 'prop-types'

import EditableLeagueField from '@components/editable-league-field'
import SettingsSection from '@components/settings-section'

export default function LeagueSettingsMiscScoring({
  league,
  isCommish,
  isDefault,
  onchange
}) {
  const props = { league, isCommish, isDefault, onchange }
  const title = 'Misc Scoring'
  const description = ''
  const body = (
    <EditableLeagueField
      label='Two PT Conv.'
      field='twoptc'
      type='int'
      max={4}
      min={0}
      {...props}
    />
  )

  return <SettingsSection {...{ body, title, description }} />
}

LeagueSettingsMiscScoring.propTypes = {
  league: PropTypes.object,
  isCommish: PropTypes.bool,
  isDefault: PropTypes.bool,
  onchange: PropTypes.func
}
