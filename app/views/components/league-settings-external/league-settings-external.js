import React from 'react'
import PropTypes from 'prop-types'
import Alert from '@mui/material/Alert'
import Grid from '@mui/material/Grid'

import EditableLeagueField from '@components/editable-league-field'
import SettingsSection from '@components/settings-section'

export default function LeagueSettingsExternal({
  league,
  isCommish,
  isDefault,
  onchange
}) {
  const disabled = !league.uid
  const props = { league, isCommish, isDefault, onchange, disabled }
  const title = 'External League'
  const description =
    'Import external leagues: espn, sleeper, mfl, or fleaflicker'
  const body = (
    <>
      {disabled && (
        <Grid xs={12} item>
          <Alert severity='warning'>
            An account is needed to import an external league. Login or
            register.
          </Alert>
        </Grid>
      )}
      {Boolean(league.uid) && (
        <Grid xs={12} item>
          <Alert severity='info'>
            External league importing is currently disabled. Will be re-enabled
            in the future.
          </Alert>
        </Grid>
      )}
      <EditableLeagueField
        label='ESPN ID'
        field='espn_id'
        type='int'
        max={4294967295}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='Sleeper ID'
        field='sleeper_id'
        type='int'
        max={4294967295}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='MFL ID'
        field='mfl_id'
        type='int'
        max={4294967295}
        min={0}
        {...props}
      />
      <EditableLeagueField
        label='Fleaflicker ID'
        field='fleaflicker_id'
        type='int'
        max={4294967295}
        min={0}
        {...props}
      />
    </>
  )

  return <SettingsSection {...{ body, title, description }} />
}

LeagueSettingsExternal.propTypes = {
  league: PropTypes.object,
  isCommish: PropTypes.bool,
  isDefault: PropTypes.bool,
  onchange: PropTypes.func
}
