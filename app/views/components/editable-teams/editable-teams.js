import React from 'react'

import SettingsTeamsTeam from '@components/settings-teams-team'
import Button from '@components/button'

import './editable-teams.styl'

export default class EditableTeams extends React.Component {
  constructor (props) {
    super(props)

    this.state = { open: false }
  }

  handleAdd = () => {
    this.props.add()
  }

  handleChange = () => {
    this.setState({ open: !this.state.open })
  }

  render = () => {
    const { isCommish, teams, league } = this.props

    if (!isCommish) {
      return null
    }

    const sorted = teams.sort((a, b) => a.uid - b.uid)

    const teamItems = []
    for (const [index, team] of sorted.entries()) {
      teamItems.push(
        <SettingsTeamsTeam key={index} tid={team.uid} />
      )
    }

    let addTeam
    if (teams.size < league.nteams) {
      addTeam = (
        <Button onClick={this.handleAdd} text>Add Team</Button>
      )
    }

    return (
      <div className='settings__section'>
        <div className='settings__section-header'>Teams</div>
        <div>
          {teamItems}
        </div>
        <div className='settings__section-row editable__teams-action'>
          {addTeam}
        </div>
      </div>
    )
  }
}
