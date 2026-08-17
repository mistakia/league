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
        field='starter_slots_quarterback'
        label='QB'
        type='int'
        max={2}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='RB'
        field='starter_slots_running_back'
        type='int'
        max={3}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='WR'
        field='starter_slots_wide_receiver'
        type='int'
        max={3}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='TE'
        field='starter_slots_tight_end'
        type='int'
        max={2}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='K'
        field='starter_slots_kicker'
        type='int'
        max={1}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='DST'
        field='starter_slots_defense_special_teams'
        type='int'
        max={1}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='RB/WR'
        field='starter_slots_running_back_wide_receiver_flex'
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
        field='starter_slots_wide_receiver_tight_end_flex'
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
