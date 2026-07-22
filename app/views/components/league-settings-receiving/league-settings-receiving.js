import React from 'react'
import PropTypes from 'prop-types'

import EditableLeagueField from '@components/editable-league-field'
import SettingsSection from '@components/settings-section'

export default function LeagueSettingsReceiving({
  league,
  isCommish,
  isDefault,
  onchange
}) {
  const props = { league, isCommish, isDefault, onchange }
  const title = 'Receiving'
  const description = 'Scoring settings for receiving stats'
  const body = (
    <>
      <EditableLeagueField
        label='Rec. (RB)'
        field='running_back_reception'
        type='float'
        max={2}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='Rec. (WR)'
        field='wide_receiver_reception'
        type='float'
        max={2}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='Rec. (TE)'
        field='tight_end_reception'
        type='float'
        max={2}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='Rec. (Other)'
        field='receptions'
        type='float'
        max={2}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='Yards'
        field='receiving_yards'
        type='float'
        max={2}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='Tds'
        field='receiving_touchdowns'
        type='int'
        max={12}
        min={0}
        {...props}
      />
    </>
  )

  return <SettingsSection {...{ body, title, description }} />
}

LeagueSettingsReceiving.propTypes = {
  league: PropTypes.object,
  isCommish: PropTypes.bool,
  isDefault: PropTypes.bool,
  onchange: PropTypes.func
}
