import React from 'react'

export default class RosterContextMenu extends React.Component {
  render = () => {
    const { player, isPracticeSquadEligible, isActiveRosterEligible, deactivate, activate, hide } = this.props
    let deactivateAction
    if (isPracticeSquadEligible) {
      deactivateAction = (
        <div className='context__menu-option' onClick={() => deactivate(player.player) && hide()}>
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
        <div className='context__menu-option' onClick={() => activate(player.player) && hide()}>
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
