import React from 'react'

import EditableTeamField from '@components/editable-team-field'
import TeamImage from '@components/team-image'

import './editable-team.styl'

export default class EditableTeam extends React.Component {
  onchange = (value) => {
    const teamId = this.props.team.uid
    this.props.update({ teamId, ...value })
  }

  render = () => {
    const { team } = this.props

    const props = { team, onchange: this.onchange }

    return (
      <div className='editable__team'>
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
        <TeamImage url={team.image} />
      </div>
    )
  }
}
