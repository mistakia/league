import React from 'react'
import Accordion from '@material-ui/core/Accordion'
import AccordionDetails from '@material-ui/core/AccordionDetails'
import AccordionSummary from '@material-ui/core/AccordionSummary'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'

import SettingsSwitch from '@components/settings-switch'

export default class SettingsNotifications extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      open: false
    }
  }

  handleChange = () => {
    this.setState({ open: !this.state.open })
  }

  render = () => {
    return (
      <Accordion expanded={this.state.open} onChange={this.handleChange}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <div className='settings__section-title'>Notifications</div>
        </AccordionSummary>
        <AccordionDetails>
          <SettingsSwitch
            field='text'
            label='Text Notifications'
            description='Enable/disable all text notifications.'
          />
          <SettingsSwitch
            field='voice'
            label='Voice Notifications'
            description='Enable/disable all voice notifications.'
          />
        </AccordionDetails>
      </Accordion>
    )
  }
}
