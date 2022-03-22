import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Paper from '@material-ui/core/Paper'
import MenuItem from '@material-ui/core/MenuItem'
import MenuList from '@material-ui/core/MenuList'

import { constants } from '@common'

export default class PlayerContextMenu extends React.Component {
  handleDeactivate = () => {
    const { player, deactivate } = this.props
    this.props.showConfirmation({
      title: 'Roster Deactivation',
      description: `${player.fname} ${player.lname} (${player.pos}) will be placed on the practice squad. He will not be available to use in lineups until he's reactivated.`,
      onConfirm: () => deactivate(player.player)
    })
    this.props.hide()
  }

  handleProtect = () => {
    const { player, protect } = this.props
    this.props.showConfirmation({
      title: 'Designate Protected',
      description: `${player.fname} ${player.lname} (${player.pos}) will be designated as protected. This will protect the player from poaches but you will not be able to activate or release this player until the off-season.`,
      onConfirm: () => protect(player.player)
    })
    this.props.hide()
  }

  handleActivate = () => {
    const { player } = this.props
    this.props.showConfirmation({
      id: 'ACTIVATE',
      data: {
        player
      }
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
    const { player, waiverId, cancelClaim } = this.props
    this.props.showConfirmation({
      title: 'Cancel claim',
      description: `Your claim for ${player.fname} ${player.lname} (${player.pos}) will no longer be processed.`,
      onConfirm: () => cancelClaim(waiverId)
    })
    this.props.hide()
  }

  handleUpdateWaiver = () => {
    const { player, waiverId } = this.props
    this.props.showConfirmation({
      id: 'WAIVER',
      data: {
        waiverId,
        player
      }
    })
    this.props.hide()
  }

  handlePoach = () => {
    const { player, poachId } = this.props
    this.props.showConfirmation({
      id: 'POACH',
      data: {
        player,
        poachId
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

  handleReserveIR = () => {
    const { player } = this.props
    this.props.showConfirmation({
      id: 'RESERVE',
      data: {
        player
      }
    })
    this.props.hide()
  }

  handleReserveCOV = () => {
    const { player, reserve } = this.props
    this.props.showConfirmation({
      title: 'Roster Reserve',
      description: `${player.fname} ${player.lname} (${player.pos}) will be placed on Reserves/COV. He will not be available to use in lineups until he's activated.`,
      onConfirm: () =>
        reserve({ player: player.player, slot: constants.slots.COV })
    })
    this.props.hide()
  }

  handleRelease = () => {
    const { player, release } = this.props
    this.props.showConfirmation({
      title: 'Release Player',
      description: `${player.fname} ${player.lname} (${player.pos}) will be released and placed on waivers for 24 hours before becoming a free agent.`,
      onConfirm: () => release(player.player)
    })
    this.props.hide()
  }

  handleFranchiseTag = () => {
    const { player } = this.props
    this.props.showConfirmation({
      id: 'FRANCHISE',
      data: {
        player
      }
    })
    this.props.hide()
  }

  handleRookieTag = () => {
    const { player } = this.props
    this.props.showConfirmation({
      id: 'ROOKIE',
      data: {
        player
      }
    })
    this.props.hide()
  }

  handleRemoveTag = () => {
    const { player } = this.props
    this.props.showConfirmation({
      id: 'REMOVE_TAG',
      data: {
        player
      }
    })
    this.props.hide()
  }

  handleTransitionTag = () => {
    const { player } = this.props
    this.props.showConfirmation({
      id: 'TRANSITION',
      data: {
        player
      }
    })
    this.props.hide()
  }

  handleRemoveTransitionTag = () => {
    const { player } = this.props
    this.props.showConfirmation({
      id: 'REMOVE_TRANSITION_TAG',
      data: {
        player
      }
    })
    this.props.hide()
  }

  handleCutlist = () => {
    const { player } = this.props.player
    this.props.toggleCutlist(player)
    this.props.hide()
  }

  render = () => {
    const { waiverId, status, isOnCutlist, poachId } = this.props

    const menuItems = []

    // context menu for waiver claims
    if (waiverId) {
      menuItems.push(
        <MenuItem key='update-waiver' dense onClick={this.handleUpdateWaiver}>
          Update Claim
        </MenuItem>
      )

      menuItems.push(
        <MenuItem key='cancel-waiver' dense onClick={this.handleCancelWaiver}>
          Cancel Claim
        </MenuItem>
      )
    } else if (status.rostered) {
      menuItems.push(
        <MenuItem
          key='activate'
          dense
          disabled={status.protected || !status.eligible.activate}
          onClick={this.handleActivate}
        >
          Activate
        </MenuItem>
      )

      menuItems.push(
        <MenuItem
          key='ps'
          dense
          disabled={!status.eligible.ps}
          onClick={this.handleDeactivate}
        >
          Move to Practice Squad
        </MenuItem>
      )

      menuItems.push(
        <MenuItem
          key='protect'
          dense
          disabled={!status.eligible.protect}
          onClick={this.handleProtect}
        >
          Designate Protected
        </MenuItem>
      )

      if (status.eligible.franchiseTag) {
        menuItems.push(
          <MenuItem
            key='franchise'
            dense
            onClick={
              status.tagged.franchise
                ? this.handleRemoveTag
                : this.handleFranchiseTag
            }
          >
            {`${status.tagged.franchise ? 'Remove' : 'Apply'} Franchise Tag`}
          </MenuItem>
        )
      }

      if (status.eligible.transitionTag) {
        menuItems.push(
          <MenuItem key='transition' dense onClick={this.handleTransitionTag}>
            {`${status.tagged.transition ? 'Update' : 'Apply'} Transition Tag`}
          </MenuItem>
        )

        if (status.tagged.transition) {
          menuItems.push(
            <MenuItem
              key='transition-remove'
              dense
              onClick={this.handleRemoveTransitionTag}
            >
              Remove Transition Tag
            </MenuItem>
          )
        }
      } else if (status.eligible.transitionBid) {
        menuItems.push(
          <MenuItem key='transition' dense onClick={this.handleTransitionTag}>
            Update Transition Tag
          </MenuItem>
        )
      }

      if (status.eligible.rookieTag) {
        menuItems.push(
          <MenuItem
            key='rookie'
            dense
            onClick={
              status.tagged.rookie ? this.handleRemoveTag : this.handleRookieTag
            }
          >
            {`${status.tagged.rookie ? 'Remove' : 'Apply'} Rookie Tag`}
          </MenuItem>
        )
      }

      if (status.active) {
        menuItems.push(
          <MenuItem key='cutlist' dense onClick={this.handleCutlist}>
            {`${isOnCutlist ? 'Remove from' : 'Add to'} Cutlist`}
          </MenuItem>
        )
      }

      menuItems.push(
        <MenuItem
          key='ir'
          dense
          disabled={!status.reserve.ir || (status.locked && status.starter)}
          onClick={this.handleReserveIR}
        >
          Move to Reserve/IR
        </MenuItem>
      )

      menuItems.push(
        <MenuItem
          key='cov'
          dense
          disabled={!status.reserve.cov || (status.locked && status.starter)}
          onClick={this.handleReserveCOV}
        >
          Move to Reserve/COV
        </MenuItem>
      )

      menuItems.push(
        <MenuItem
          key='release'
          dense
          disabled={status.protected || (status.locked && status.starter)}
          onClick={this.handleRelease}
        >
          Release
        </MenuItem>
      )
    } else if (poachId) {
      menuItems.push(
        <MenuItem key='update-poach' dense onClick={this.handlePoach}>
          Update Poach
        </MenuItem>
      )
    } else if (!status.fa) {
      if (status.eligible.transitionBid) {
        menuItems.push(
          <MenuItem key='transition' dense onClick={this.handleTransitionTag}>
            {`${status.bid ? 'Update' : 'Place'} Transition Bid`}
          </MenuItem>
        )

        if (status.bid) {
          menuItems.push(
            <MenuItem
              key='transition-remove'
              dense
              onClick={this.handleRemoveTransitionTag}
            >
              Remove Transition Bid
            </MenuItem>
          )
        }
      }

      const text = status.waiver.poach
        ? 'Submit Poaching Waiver Claim'
        : 'Submit Poaching Claim'

      menuItems.push(
        <MenuItem
          key='poach'
          dense
          disabled={!status.eligible.poach}
          onClick={this.handlePoach}
        >
          {text}
        </MenuItem>
      )
    } else {
      // player is a free agent

      if (status.waiver.practice) {
        menuItems.push(
          <MenuItem key='waiver' dense onClick={this.handleWaiver}>
            Submit Practice Squad Waiver
          </MenuItem>
        )
      } else if (status.sign.practice) {
        menuItems.push(
          <MenuItem
            key='sign-ps'
            dense
            onClick={() => this.handleAdd({ practice: true })}
          >
            Sign to Practice Squad
          </MenuItem>
        )
      }

      if (status.waiver.active) {
        menuItems.push(
          <MenuItem key='waiver' dense onClick={this.handleWaiver}>
            Submit Active Roster Waiver
          </MenuItem>
        )
      } else if (status.sign.active) {
        menuItems.push(
          <MenuItem key='sign-active' dense onClick={() => this.handleAdd()}>
            Sign to Active Roster
          </MenuItem>
        )
      }
    }

    return (
      <Paper>
        <MenuList>{menuItems}</MenuList>
      </Paper>
    )
  }
}

PlayerContextMenu.propTypes = {
  player: ImmutablePropTypes.record,
  status: PropTypes.object,
  showContext: PropTypes.func,
  hide: PropTypes.func,
  deactivate: PropTypes.func,
  showConfirmation: PropTypes.func,
  cancelClaim: PropTypes.func,
  reserve: PropTypes.func,
  release: PropTypes.func,
  protect: PropTypes.func,
  waiverId: PropTypes.number,
  poachId: PropTypes.number,
  toggleCutlist: PropTypes.func,
  isOnCutlist: PropTypes.bool
}
