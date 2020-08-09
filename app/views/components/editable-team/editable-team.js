import React from 'react'

import EditableTeamField from '@components/editable-team-field'
import EditableTeamSwitch from '@components/editable-team-switch'
import TeamImage from '@components/team-image'

import './editable-team.styl'

export default class EditableTeam extends React.Component {
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
          <div className='editable__team-section'>
            <EditableTeamSwitch
              label='Team Text Notifications'
              description='Poaching claims and trades'
              field='teamtext'
              {...props}
            />
          </div>
          <div className='editable__team-section'>
            <EditableTeamSwitch
              label='Team Voice Notifications'
              description='Poaching claims'
              field='teamvoice'
              {...props}
            />
          </div>
          <div className='editable__team-section'>
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
      <div className='editable__team'>
        <div className='editable__team-section'>
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
      </div>
    )
  }
}
