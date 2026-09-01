import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import FormControl from '@mui/material/FormControl'
import MenuItem from '@mui/material/MenuItem'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'

import Modal from '@components/modal'
import Button from '@components/button'
import { player_tag_types } from '#constants'

export default class RookieConfirmation extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      untag: '',
      error: false,
      missingUntag: false
    }

    const { team } = props
    this._isEligible = team.roster.isEligibleForTag({
      tag: player_tag_types.ROOKIE
    })
    this._untags = []
    const tagged_players = team.roster.getPlayersByTag(player_tag_types.ROOKIE)
    tagged_players.forEach(({ pid }) => {
      const taggedPlayerMap = team.players.find(
        (player_map) => player_map.get('pid') === pid
      )
      this._untags.push(taggedPlayerMap)
    })
  }

  handleUntag = (event) => {
    const { value } = event.target
    this.setState({ untag: value, missingUntag: false })
  }

  handleSubmit = () => {
    const { untag, error } = this.state
    const pid = this.props.player_map.get('pid')

    if (!this._isEligible && !untag) {
      return this.setState({ missingUntag: true })
    } else {
      this.setState({ missingUntag: false })
    }

    if (!error) {
      this.props.add({ remove: untag, tag: player_tag_types.ROOKIE, pid })
      this.props.onClose()
    }
  }

  render = () => {
    const { player_map } = this.props

    const menuItems = []
    for (const taggedPlayerMap of this._untags) {
      const pid = taggedPlayerMap.get('pid')
      menuItems.push(
        <MenuItem key={pid} value={pid}>
          {taggedPlayerMap.get('name')} (
          {taggedPlayerMap.get('primary_position')})
        </MenuItem>
      )
    }

    return (
      <Modal
        open
        onClose={this.props.onClose}
        title='Rookie Tag'
        actions={
          <>
            <Button onClick={this.props.onClose} text>
              Cancel
            </Button>
            <Button onClick={this.handleSubmit} text>
              Confirm
            </Button>
          </>
        }
      >
        <p>
          {`Apply Rookie Tag to ${player_map.get('name')} (${player_map.get('primary_position')})`}
        </p>
        <div className='confirmation__inputs'>
          {!this._isEligible && (
            <FormControl size='small' variant='outlined'>
              <InputLabel id='untag-label'>Remove Tag</InputLabel>
              <Select
                labelId='untag-label'
                error={this.state.missingUntag}
                value={this.state.untag}
                onChange={this.handleUntag}
                label='Remove Tag'
              >
                {menuItems}
              </Select>
            </FormControl>
          )}
        </div>
      </Modal>
    )
  }
}

RookieConfirmation.propTypes = {
  team: PropTypes.object,
  add: PropTypes.func,
  player_map: ImmutablePropTypes.map,
  onClose: PropTypes.func
}
