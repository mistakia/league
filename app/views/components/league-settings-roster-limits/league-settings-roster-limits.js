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
        field='max_roster_quarterback'
        type='int'
        max={7}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='RB'
        field='max_roster_running_back'
        type='int'
        max={20}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='WR'
        field='max_roster_wide_receiver'
        type='int'
        max={20}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='TE'
        field='max_roster_tight_end'
        type='int'
        max={10}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='K'
        field='max_roster_kicker'
        type='int'
        max={5}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='DST'
        field='max_roster_defense_special_teams'
        type='int'
        max={4}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='Bench'
        field='bench_slot_count'
        type='int'
        max={20}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='PS'
        field='practice_squad_slot_count'
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
