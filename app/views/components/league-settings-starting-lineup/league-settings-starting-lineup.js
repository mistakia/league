import React from 'react'
import PropTypes from 'prop-types'

import EditableLeagueField from '@components/editable-league-field'
import SettingsSection from '@components/settings-section'

export default function LeagueSettingsStartingLineup({
  league,
  isCommish,
  isDefault,
  onchange
}) {
  const props = { league, isCommish, isDefault, onchange }
  const title = 'Starting Lineup'
  const description = ''
  const body = (
    <>
      <EditableLeagueField
        field='sqb'
        label='QB'
        type='int'
        max={2}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='RB'
        field='srb'
        type='int'
        max={3}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='WR'
        field='swr'
        type='int'
        max={3}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='TE'
        field='ste'
        type='int'
        max={2}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='K'
        field='sk'
        type='int'
        max={1}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='DST'
        field='sdst'
        type='int'
        max={1}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='RB/WR'
        field='srbwr'
        type='int'
        max={3}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='RB/WR/TE'
        field='srbwrte'
        type='int'
        max={3}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='QB/RB/WR/TE'
        field='sqbrbwrte'
        type='int'
        max={1}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='WR/TE'
        field='swrte'
        type='int'
        max={2}
        min={0}
        {...props}
      />
    </>
  )

  return <SettingsSection {...{ body, title, description }} />
}

LeagueSettingsStartingLineup.propTypes = {
  league: PropTypes.object,
  isCommish: PropTypes.bool,
  isDefault: PropTypes.bool,
  onchange: PropTypes.func
}
