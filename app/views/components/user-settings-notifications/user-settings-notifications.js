import React, { useState } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

import SettingsSwitch from '@components/settings-switch'

export default function UserSettingsNotifications({ user, update }) {
  const [open, set_open] = useState(false)

  const handle_change = ({ type, value }) => {
    update({ type, value })
  }

  const props = { data: user, on_change: handle_change }

  return (
    <Accordion expanded={open} onChange={() => set_open(!open)}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <div className='settings__section-title'>Notifications</div>
      </AccordionSummary>
      <AccordionDetails>
        <SettingsSwitch
          field='user_text_notifications'
          label='Text Notifications'
          description='Enable/disable all text notifications.'
          {...props}
        />
        <SettingsSwitch
          field='user_voice_notifications'
          label='Voice Notifications'
          description='Enable/disable all voice notifications.'
          {...props}
        />
      </AccordionDetails>
    </Accordion>
  )
}

UserSettingsNotifications.propTypes = {
  user: PropTypes.oneOfType([ImmutablePropTypes.record, PropTypes.object]),
  update: PropTypes.func
}
