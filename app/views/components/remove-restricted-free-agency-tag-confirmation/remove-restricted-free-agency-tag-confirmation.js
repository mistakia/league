import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import Modal from '@components/modal'
import Button from '@components/button'

export default class RemoveRestrictedFreeAgencyTagConfirmation
  extends React.Component
{
  handleSubmit = () => {
    const pid = this.props.player_map.get('pid')
    const { tid } = this.props.team.roster
    this.props.remove({ pid, teamId: tid })
    this.props.onClose()
  }

  render() {
    const { player_map } = this.props

    return (
      <Modal
        open
        onClose={this.props.onClose}
        title='Remove Restricted Free Agency Bid'
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
          {`Remove Restricted Free Agency Bid on ${player_map.get(
            'name'
          )} (${player_map.get('primary_position')})`}
        </p>
      </Modal>
    )
  }
}

RemoveRestrictedFreeAgencyTagConfirmation.propTypes = {
  player_map: ImmutablePropTypes.map,
  team: PropTypes.object,
  remove: PropTypes.func,
  onClose: PropTypes.func
}
