import React from 'react'
import PropTypes from 'prop-types'

import LeagueSettingsStartingLineup from '@components/league-settings-starting-lineup'
import LeagueSettingsRosterLimits from '@components/league-settings-roster-limits'
import LeagueSettingsPassing from '@components/league-settings-passing'
import LeagueSettingsRushing from '@components/league-settings-rushing'
import LeagueSettingsReceiving from '@components/league-settings-receiving'
import LeagueSettingsMiscScoring from '@components/league-settings-misc-scoring'
import LeagueSettingsGeneral from '@components/league-settings-general'
import LeagueSettingsExternal from '@components/league-settings-external'
import { constants } from '@libs-shared'

export default function EditableLeague({ update, league, userId }) {
  const onchange = (value) => {
    const leagueId = league.uid || constants.DEFAULTS.LEAGUE_ID
    update({ leagueId, ...value })
  }

  const isCommish = league.commishid === userId
  const isDefault = !league.commishid
  const is_external_league = !league.hosted

  const props = { league, isCommish, isDefault, onchange }

  return (
    <>
      <LeagueSettingsGeneral {...props} />
      {is_external_league && <LeagueSettingsExternal {...props} />}
      <LeagueSettingsStartingLineup {...props} />
      <LeagueSettingsRosterLimits {...props} />
      <LeagueSettingsPassing {...props} />
      <LeagueSettingsRushing {...props} />
      <LeagueSettingsReceiving {...props} />
      <LeagueSettingsMiscScoring {...props} />
    </>
  )
}

EditableLeague.propTypes = {
  league: PropTypes.object,
  update: PropTypes.func,
  userId: PropTypes.number
}
