import React from 'react'

export default class RosterContextMenu extends React.Component {
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

  render = () => {
    const { isPracticeSquadEligible, isActiveRosterEligible } = this.props
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

    return (
      <div>
        {activateAction}
        {deactivateAction}
        <div className='context__menu-option disabled'>
          Drop
        </div>
      </div>
    )
  }
}
