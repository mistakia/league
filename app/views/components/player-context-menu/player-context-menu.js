import React from 'react'

import { constants } from '@common'

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
      id: 'waiver',
      player
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
      id: 'poach',
      player
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
      data,
      status
    } = this.props

    const { waiverId } = data

    // context menu for waiver claims
    if (waiverId) {
      return (
        <div>
          <div className='context__menu-option' onClick={this.handleCancelWaiver}>
            Cancel Claim
          </div>
        </div>
      )
    }

    let deactivateAction
    if (isPracticeSquadEligible) {
      deactivateAction = (
        <div className='context__menu-option' onClick={this.handleDeactivate}>
          Deactivate
        </div>
      )
    } else {
      deactivateAction = (
        <div className='context__menu-option disabled'>
          Deactivate
        </div>
      )
    }

    let activateAction
    if (isActiveRosterEligible) {
      activateAction = (
        <div className='context__menu-option' onClick={this.handleActivate}>
          Activate
        </div>
      )
    } else {
      activateAction = (
        <div className='context__menu-option disabled'>
          Activate
        </div>
      )
    }

    if (isOnCurrentRoster) {
      return (
        <div>
          {activateAction}
          {deactivateAction}
          <div className='context__menu-option disabled'>
            Drop
          </div>
        </div>
      )
    } else if (isPlayerRostered) {
      if (isPlayerOnPracticeSquad) {
        if (status.waiver.poach) {
          return (
            <div>
              <div className='context__menu-option' onClick={this.handlePoach}>
                Submit Poaching Waiver Claim
              </div>
            </div>
          )
        } else if (hasExistingPoachingClaim) {
          return (
            <div>
              <div className='context__menu-option disabled'>
                Submit Poaching Claim
              </div>
            </div>
          )
        } else {
          return (
            <div>
              <div className='context__menu-option' onClick={this.handlePoach}>
                Submit Poaching Claim
              </div>
            </div>
          )
        }
      } else {
        return (
          <div>
            <div className='context__menu-option disabled'>
              Submit Poaching Claim
            </div>
          </div>
        )
      }
    } else { // player is a free agent
      let claimAction
      if (constants.season.isRegularSeason && status.waiver.add) {
        claimAction = (
          <div className='context__menu-option' onClick={this.handleWaiver}>
            Submit Waiver Claim
          </div>
        )
      } else {
        claimAction = (
          <div className='context__menu-option disabled'>
            Submit Waiver Claim
          </div>
        )
      }

      return (
        <div>
          {claimAction}
          <div className='context__menu-option disabled'>
            Add To Roster
          </div>
          <div className='context__menu-option disabled'>
            Add To Practice Squad
          </div>
        </div>
      )
    }
  }
}
