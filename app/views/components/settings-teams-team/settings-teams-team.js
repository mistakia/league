import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Accordion from '@components/accordion'
import IconButton from '@components/icon-button'
import EditableSettingField from '@components/editable-setting-field'
import SettingsTeamsTeamPlayer from '@components/settings-teams-team-player'

import Button from '@components/button'

import './settings-teams-team.styl'

export default class SettingsTeamsTeam extends React.Component {
  handleAdd = () => {
    const { team } = this.props
    this.props.showConfirmation({
      id: 'EDIT_TEAM_ADD_PLAYER',
      data: {
        team
      }
    })
  }

  onChange = (value) => {
    const teamId = this.props.team.team_id
    this.props.update({ teamId, ...value })
  }

  handleConfirmation = () => {
    this.props.showConfirmation({
      title: 'Delete Team',
      description:
        'Remove team from league and permanently delete team & roster data',
      on_confirm_func: () => this.props.delete(this.props.team.team_id)
    })
  }

  render = () => {
    const { team, teamId, roster } = this.props

    const rosterItems = []
    for (const [index, rosterPlayer] of roster.all.entries()) {
      rosterItems.push(
        <SettingsTeamsTeamPlayer
          key={index}
          pid={rosterPlayer.pid}
          teamId={team.team_id}
          value={rosterPlayer.player_salary}
        />
      )
    }
    // The delete button is the accordion's `action` rather than part of its
    // summary. It used to sit INSIDE the summary, which MUI renders as a
    // <button> — so this was a button nested in a button, and clicking delete
    // also toggled the panel open.
    return (
      <Accordion
        summary={<div className='settings__section-title'>{team.name}</div>}
        action={
          team.team_id !== teamId && (
            <Button text onClick={() => this.handleConfirmation(team.team_id)}>
              delete
            </Button>
          )
        }
      >
        <EditableSettingField
          label='Team Name'
          field='name'
          limit={100}
          data={this.props.team}
          on_change={this.onChange}
        />
        <div className='heading__section-title'>
          Players
          <IconButton icon='add-circle-outline' onClick={this.handleAdd} />
        </div>
        <div className='settings__teams-team-roster empty'>{rosterItems}</div>
      </Accordion>
    )
  }
}

SettingsTeamsTeam.propTypes = {
  teamId: PropTypes.number,
  delete: PropTypes.func,
  showConfirmation: PropTypes.func,
  update: PropTypes.func,
  team: ImmutablePropTypes.record,
  roster: PropTypes.object
}
