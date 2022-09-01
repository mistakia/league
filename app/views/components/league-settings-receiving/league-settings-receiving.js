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
        field='rbrec'
        type='float'
        max={2}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='Rec. (WR)'
        field='wrrec'
        type='float'
        max={2}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='Rec. (TE)'
        field='terec'
        type='float'
        max={2}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='Rec. (Other)'
        field='rec'
        type='float'
        max={2}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='Yards'
        field='recy'
        type='float'
        max={2}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='Tds'
        field='tdrec'
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
