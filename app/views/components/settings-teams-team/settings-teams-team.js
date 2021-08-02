import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Accordion from '@material-ui/core/Accordion'
import AccordionDetails from '@material-ui/core/AccordionDetails'
import AccordionSummary from '@material-ui/core/AccordionSummary'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import IconButton from '@material-ui/core/IconButton'
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline'

import EditableTeamField from '@components/editable-team-field'
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
    for (const [index, player] of roster.all.entries()) {
      rosterItems.push(
        <SettingsTeamsTeamPlayer
          key={index}
          playerId={player.player}
          teamId={team.uid}
          value={player.value}
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
          <EditableTeamField
            label='Team Name'
            field='name'
            limit={100}
            team={this.props.team}
            onchange={this.onChange}
          />
          <div className='editable__league-section-title'>
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
