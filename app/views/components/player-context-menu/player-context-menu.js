import React from 'react'
import Grow from '@material-ui/core/Grow'
import Paper from '@material-ui/core/Paper'
import MenuItem from '@material-ui/core/MenuItem'
import MenuList from '@material-ui/core/MenuList'

export default class PlayerContextMenu extends React.Component {
  handleDeactivate = () => {
    const { player, deactivate } = this.props
    this.props.showConfirmation({
      title: 'Roster Deactivation',
      description: `${player.fname} ${player.lname} (${player.pos1}) will be placed on the practice squad. He will not be available to use in lineups until he's reactivated.`,
      onConfirm: () => deactivate(player.player)
    })
    this.props.hide()
  }

  handleActivate = () => {
    const { player, activate } = this.props
    this.props.showConfirmation({
      title: 'Roster Activation',
      description: `${player.fname} ${player.lname} (${player.pos1}) will be placed on the active roster. He will no longer be eligble for the practice squad.`,
      onConfirm: () => activate(player.player)
    })
    this.props.hide()
  }

  handleWaiver = () => {
    const { player } = this.props
    this.props.showConfirmation({
      id: 'WAIVER',
      data: {
        player
      }
    })
    this.props.hide()
  }

  handleCancelWaiver = () => {
    const { player, data, cancelClaim } = this.props
    this.props.showConfirmation({
      title: 'Cancel claim',
      description: `Your claim for ${player.fname} ${player.lname} (${player.pos1}) will no longer be processed.`,
      onConfirm: () => cancelClaim(data.waiverId)
    })
  }

  handlePoach = () => {
    const { player } = this.props
    this.props.showConfirmation({
      id: 'POACH',
      data: {
        player
      }
    })
    this.props.hide()
  }

  handleAdd = ({ practice = false } = {}) => {
    const { player } = this.props
    this.props.showConfirmation({
      id: 'ADD_FREE_AGENT',
      data: {
        player,
        practice
      }
    })
    this.props.hide()
  }

  render = () => {
    const {
      isPracticeSquadEligible,
      isActiveRosterEligible,
      isOnCurrentRoster,
      isPlayerRostered,
      isPlayerOnPracticeSquad,
      hasExistingPoachingClaim,
      hasAuctionCompleted,
      waiverId,
      status,
      hasDraftClockExpired,
      isPlayerEligibleToDeactivate
    } = this.props

    const menuItems = []

    // context menu for waiver claims
    if (waiverId) {
      menuItems.push(
        <MenuItem
          dense
          onClick={this.handleCancelWaiver}
        >
          Cancel Claim
        </MenuItem>
      )
    } else if (isOnCurrentRoster) {
      menuItems.push(
        <MenuItem
          dense
          disabled={!isActiveRosterEligible}
          onClick={this.handleActivate}
        >
          Activate
        </MenuItem>
      )

      menuItems.push(
        <MenuItem
          dense
          disabled={!isPlayerEligibleToDeactivate}
          onClick={this.handleDeactivate}
        >
          Deactivate
        </MenuItem>
      )

      menuItems.push(
        <MenuItem
          dense
          disabled
        >
          Release
        </MenuItem>
      )
    } else if (isPlayerRostered) {
      const text = status.waiver.poach
        ? 'Submit Poaching Waiver Claim'
        : 'Submit Poaching Claim'

      menuItems.push(
        <MenuItem
          dense
          disabled={hasExistingPoachingClaim || !isPlayerOnPracticeSquad}
          onClick={this.handlePoach}
        >
          {text}
        </MenuItem>
      )
    } else {
      // player is a free agent

      menuItems.push(
        <MenuItem
          dense
          disabled={!status.waiver.add || !hasAuctionCompleted}
          onClick={this.handleWaiver}
        >
          Submit Waiver Claim
        </MenuItem>
      )

      menuItems.push(
        <MenuItem
          dense
          disabled={status.waiver.add}
          onClick={() => this.handleAdd()}
        >
          Add to Active Roster
        </MenuItem>
      )
      menuItems.push(
        <MenuItem
          dense
          disabled={!isPracticeSquadEligible || !hasDraftClockExpired}
          onClick={() => this.handleAdd({ practice: true })}
        >
          Add to Practice Squad
        </MenuItem>
      )
    }

    return (
      <Grow in>
        <Paper>
          <MenuList>
            {menuItems}
          </MenuList>
        </Paper>
      </Grow>
    )
  }
}
