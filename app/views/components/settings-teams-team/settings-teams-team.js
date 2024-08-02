import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import IconButton from '@mui/material/IconButton'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'

import EditableSettingField from '@components/editable-setting-field'
import SettingsTeamsTeamPlayer from '@components/settings-teams-team-player'

import Button from '@components/button'

import './settings-teams-team.styl'

export default class SettingsTeamsTeam extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      open: false
    }
  }

  handleAdd = () => {
    const { team } = this.props
    this.props.showConfirmation({
      id: 'EDIT_TEAM_ADD_PLAYER',
      data: {
        team
      }
    })
  }

  handleChange = () => {
    this.setState({ open: !this.state.open })
  }

  onChange = (value) => {
    const teamId = this.props.team.uid
    this.props.update({ teamId, ...value })
  }

  handleConfirmation = () => {
    this.props.showConfirmation({
      title: 'Delete Team',
      description:
        'Remove team from league and permanently delete team & roster data',
      onConfirm: () => this.props.delete(this.props.team.uid)
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
          teamId={team.uid}
          value={rosterPlayer.value}
        />
      )
    }
    return (
      <Accordion expanded={this.state.open} onChange={this.handleChange}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <div className='settings__section-title'>{team.name}</div>
          <div className='settings__section-action'>
            {team.uid !== teamId && (
              <Button text onClick={() => this.handleConfirmation(team.uid)}>
                delete
              </Button>
            )}
          </div>
        </AccordionSummary>
        <AccordionDetails>
          <EditableSettingField
            label='Team Name'
            field='name'
            limit={100}
            data={this.props.team}
            onchange={this.onChange}
          />
          <div className='heading__section-title'>
            Players
            <IconButton onClick={this.handleAdd}>
              <AddCircleOutlineIcon />
            </IconButton>
          </div>
          <div className='settings__teams-team-roster empty'>{rosterItems}</div>
        </AccordionDetails>
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
