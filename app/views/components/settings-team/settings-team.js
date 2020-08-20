import React from 'react'
import Accordion from '@material-ui/core/Accordion'
import AccordionDetails from '@material-ui/core/AccordionDetails'
import AccordionSummary from '@material-ui/core/AccordionSummary'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'

import EditableTeamField from '@components/editable-team-field'
import EditableTeamSwitch from '@components/editable-team-switch'
import TeamImage from '@components/team-image'

import './settings-team.styl'

export default class SettingsTeam extends React.Component {
  constructor (props) {
    super(props)

    this.state = { open: false }
  }

  handleChange = () => {
    this.setState({ open: !this.state.open })
  }

  onchange = (value) => {
    const teamId = this.props.team.uid
    this.props.update({ teamId, ...value })
  }

  render = () => {
    const { team, isHosted } = this.props

    const props = { team, onchange: this.onchange }

    let teamNotificationSection
    if (isHosted) {
      teamNotificationSection = (
        <div>
          <div className='settings__team-section'>
            <EditableTeamSwitch
              label='Team Text Notifications'
              description='Poaching claims and trades'
              field='teamtext'
              {...props}
            />
          </div>
          <div className='settings__team-section'>
            <EditableTeamSwitch
              label='Team Voice Notifications'
              description='Poaching claims'
              field='teamvoice'
              {...props}
            />
          </div>
          <div className='settings__team-section'>
            <EditableTeamSwitch
              label='League Text Notifications'
              description='Poaching claims, trades, draft selections, dropped players and added players'
              field='leaguetext'
              {...props}
            />
          </div>
        </div>
      )
    }

    return (
      <Accordion expanded={this.state.open} onChange={this.handleChange}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
        >
          <div className='settings__section-title'>Team</div>
          <div className='settings__section-description'>Edit Name / Abbreviation / Logo</div>
        </AccordionSummary>
        <AccordionDetails>
          <div className='settings__team-section'>
            <EditableTeamField
              label='Team Name'
              field='name'
              limit={100}
              {...props}
            />
            <EditableTeamField
              label='Abbreviation'
              field='abbrv'
              limit={5}
              {...props}
            />
            <EditableTeamField
              label='Logo (URL)'
              field='image'
              {...props}
            />
            <TeamImage tid={team.uid} />
          </div>
          {teamNotificationSection}
        </AccordionDetails>
      </Accordion>
    )
  }
}
