import React from 'react'
import PropTypes from 'prop-types'

import EditableLeagueField from '@components/editable-league-field'
import SettingsSection from '@components/settings-section'

export default function LeagueSettingsGeneral({
  league,
  isCommish,
  isDefault,
  onchange
}) {
  const props = { league, isCommish, isDefault, onchange }
  const title = 'General'
  const description = 'Name / Number of Teams / Salary'
  const body = (
    <>
      <EditableLeagueField
        field='name'
        label='Name'
        length={80}
        {...props}
        grid={{ xs: 12 }}
      />
      <EditableLeagueField
        label='Number of Teams'
        field='num_teams'
        type='int'
        max={20}
        min={4}
        {...props}
      />
      <EditableLeagueField
        label='FAAB Budget'
        field='faab'
        type='int'
        max={1000000}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='CAP Limit'
        field='cap'
        type='int'
        max={1000000}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='Min Bid'
        field='min_bid'
        type='int'
        max={1}
        min={0}
        {...props}
      />
    </>
  )

  return <SettingsSection {...{ body, title, description }} />
}

LeagueSettingsGeneral.propTypes = {
  league: PropTypes.object,
  isCommish: PropTypes.bool,
  isDefault: PropTypes.bool,
  onchange: PropTypes.func
}
