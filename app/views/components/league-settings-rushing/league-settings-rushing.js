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
        field='rushing_attempts'
        type='float'
        max={1}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='Yards'
        field='rushing_yards'
        type='float'
        max={2}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='Fumbles'
        field='fumbles_lost'
        type='int'
        max={0}
        min={-3}
        {...props}
      />
      <EditableLeagueField
        label='Tds'
        field='rushing_touchdowns'
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
