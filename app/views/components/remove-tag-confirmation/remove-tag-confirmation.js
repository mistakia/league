import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import Modal from '@components/modal'
import Button from '@components/button'
import { player_tag_display_names } from '#constants'

export default class RemoveTagConfirmation extends React.Component {
  handleSubmit = () => {
    const pid = this.props.player_map.get('pid')
    const { tid } = this.props.team.roster
    this.props.remove({ pid, teamId: tid })
    this.props.onClose()
  }

  render() {
    const { player_map } = this.props
    const tagType = player_tag_display_names[player_map.get('tag')]

    return (
      <Modal
        open
        onClose={this.props.onClose}
        title={`Remove ${tagType} Tag`}
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
          {`Remove ${tagType} Tag from ${player_map.get(
            'name'
          )} (${player_map.get('primary_position')})`}
        </p>
      </Modal>
    )
  }
}

RemoveTagConfirmation.propTypes = {
  player_map: ImmutablePropTypes.map,
  team: PropTypes.object,
  remove: PropTypes.func,
  onClose: PropTypes.func
}
