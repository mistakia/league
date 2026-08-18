import React from 'react'
import PropTypes from 'prop-types'

import EditableLeagueField from '@components/editable-league-field'
import SettingsSection from '@components/settings-section'
import { scoring_columns } from '#libs-shared/scoring-columns.mjs'

// Renders every editable scoring column in one registry `section`.
//
// The hand-written siblings (league-settings-passing and friends) repeat the
// label, field name, type and bounds that libs-shared/scoring-columns.mjs
// already carries, which is how a settings page ends up disagreeing with the
// column it edits. Driving the markup from the registry means a new scoring
// column appears here by virtue of having an entry, with no JSX to write.
//
// `min` and `max` are optional in the registry and EditableLeagueField already
// treats them as optional, so an entry without bounds renders an unbounded
// field rather than being skipped.
export default function LeagueSettingsScoringSection({
  section,
  title,
  description = '',
  league,
  isCommish,
  isDefault,
  onchange
}) {
  const props = { league, isCommish, isDefault, onchange }
  const entries = scoring_columns.filter((entry) => entry.section === section)

  const body = (
    <>
      {entries.map((entry) => (
        <EditableLeagueField
          key={entry.column}
          label={entry.label}
          field={entry.column}
          type={entry.input_type}
          max={entry.max}
          min={entry.min}
          {...props}
        />
      ))}
    </>
  )

  return <SettingsSection {...{ body, title, description }} />
}

LeagueSettingsScoringSection.propTypes = {
  section: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  league: PropTypes.object,
  isCommish: PropTypes.bool,
  isDefault: PropTypes.bool,
  onchange: PropTypes.func
}
