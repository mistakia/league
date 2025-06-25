import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import MenuItem from '@mui/material/MenuItem'
import MenuList from '@mui/material/MenuList'
import Button from '@mui/material/Button'
import ButtonGroup from '@mui/material/ButtonGroup'

import { constants } from '@libs-shared'

export default function PlayerContextMenu({
  playerMap,
  status,
  hide,
  showConfirmation,
  cancelClaim,
  reserve,
  release,
  protect,
  waiverId,
  poachId,
  toggle_cutlist,
  isOnCutlist,
  hideDisabled,
  buttonGroup,
  isNominating,
  nominate_pid,
  nominate_restricted_free_agent,
  unnominate_restricted_free_agent
}) {
  console.log({ status })
  const handleDeactivate = () => {
    showConfirmation({
      id: 'DEACTIVATE',
      data: {
        playerMap,
        pid: playerMap.get('pid')
      }
    })
    hide()
  }

  const handleProtect = () => {
    showConfirmation({
      title: 'Designate Protected',
      description: `${playerMap.get('fname')} ${playerMap.get(
        'lname'
      )} (${playerMap.get(
        'pos'
      )}) will be designated as protected. This will protect the player from poaches but you will not be able to activate or release this player until the off-season.`,
      onConfirm: () => protect(playerMap.get('pid'))
    })
    hide()
  }

  const handleActivate = () => {
    showConfirmation({
      id: 'ACTIVATE',
      data: {
        playerMap
      }
    })
    hide()
  }

  const handleWaiver = () => {
    showConfirmation({
      id: 'WAIVER',
      data: {
        playerMap
      }
    })
    hide()
  }

  const handleCancelWaiver = () => {
    showConfirmation({
      title: 'Cancel claim',
      description: `Your claim for ${playerMap.get('fname')} ${playerMap.get(
        'lname'
      )} (${playerMap.get('pos')}) will no longer be processed.`,
      onConfirm: () => cancelClaim(waiverId)
    })
    hide()
  }

  const handleUpdateWaiver = () => {
    showConfirmation({
      id: 'WAIVER',
      data: {
        waiverId,
        playerMap
      }
    })
    hide()
  }

  const handlePoach = () => {
    showConfirmation({
      id: 'POACH',
      data: {
        playerMap,
        poachId
      }
    })
    hide()
  }

  const handleAdd = ({ practice = false } = {}) => {
    showConfirmation({
      id: 'ADD_FREE_AGENT',
      data: {
        playerMap,
        practice
      }
    })
    hide()
  }

  const handleReserveIR = () => {
    showConfirmation({
      id: 'RESERVE',
      data: {
        playerMap
      }
    })
    hide()
  }

  const handleReserveIRLongTerm = () => {
    showConfirmation({
      id: 'RESERVE_IR_LONG_TERM',
      data: {
        playerMap
      }
    })
    hide()
  }

  const handleReserveCOV = () => {
    showConfirmation({
      title: 'Roster Reserve',
      description: `${playerMap.get('fname')} ${playerMap.get(
        'lname'
      )} (${playerMap.get(
        'pos'
      )}) will be placed on Reserves/COV. He will not be available to use in lineups until he's activated.`,
      onConfirm: () =>
        reserve({
          reserve_pid: playerMap.get('pid'),
          slot: constants.slots.COV
        })
    })
    hide()
  }

  const handleRelease = () => {
    showConfirmation({
      title: 'Release Player',
      description: `${playerMap.get('fname')} ${playerMap.get(
        'lname'
      )} (${playerMap.get(
        'pos'
      )}) will be released and placed on waivers for 24 hours before becoming a free agent.`,
      onConfirm: () => release(playerMap.get('pid'))
    })
    hide()
  }

  const handleFranchiseTag = () => {
    showConfirmation({
      id: 'FRANCHISE',
      data: {
        playerMap
      }
    })
    hide()
  }

  const handleRookieTag = () => {
    showConfirmation({
      id: 'ROOKIE',
      data: {
        playerMap
      }
    })
    hide()
  }

  const handleRemoveTag = () => {
    showConfirmation({
      id: 'REMOVE_TAG',
      data: {
        playerMap
      }
    })
    hide()
  }

  const handleTransitionTag = () => {
    showConfirmation({
      id: 'TRANSITION',
      data: {
        playerMap
      }
    })
    hide()
  }

  const handleRemoveTransitionTag = () => {
    showConfirmation({
      id: 'REMOVE_TRANSITION_TAG',
      data: {
        playerMap
      }
    })
    hide()
  }

  const handleCutlist = () => {
    const pid = playerMap.get('pid')
    toggle_cutlist(pid)
    hide()
  }

  const handleNominate = () => {
    nominate_pid(playerMap.get('pid'))
    hide()
  }

  const handle_nominate_restricted_free_agent = () => {
    nominate_restricted_free_agent(playerMap.get('pid'))
    hide()
  }

  const handle_unnominate_restricted_free_agent = () => {
    unnominate_restricted_free_agent(playerMap.get('pid'))
    hide()
  }

  const items = []

  const add = ({ disabled, label, ...params }) => {
    if (disabled && hideDisabled) return
    if (buttonGroup) {
      items.push(
        <Button size='small' {...{ disabled, ...params }}>
          {label}
        </Button>
      )
    } else {
      items.push(
        <MenuItem dense {...{ disabled, ...params }}>
          {label}
        </MenuItem>
      )
    }
  }

  // context menu for waiver claims
  if (waiverId) {
    add({
      key: 'update-waiver',
      onClick: handleUpdateWaiver,
      label: 'Update Claim'
    })

    add({
      key: 'cancel-waiver',
      onClick: handleCancelWaiver,
      label: 'Cancel Claim'
    })
  } else if (status.rostered) {
    add({
      key: 'activate',
      onClick: handleActivate,
      disabled: status.protected || !status.eligible.activate,
      label: 'Activate'
    })

    add({
      key: 'ps',
      onClick: handleDeactivate,
      disabled: !status.eligible.ps,
      label: 'Move to Practice Squad'
    })

    add({
      key: 'protect',
      onClick: handleProtect,
      disabled: !status.eligible.protect,
      label: 'Designate Protected'
    })

    if (constants.season.isOffseason && status.eligible.franchiseTag) {
      add({
        key: 'franchise',
        onClick: status.tagged.franchise ? handleRemoveTag : handleFranchiseTag,
        label: `${status.tagged.franchise ? 'Remove' : 'Apply'} Franchise Tag`
      })
    }

    if (constants.season.isOffseason && status.eligible.transitionTag) {
      add({
        key: 'transition',
        onClick: handleTransitionTag,
        label: `${status.tagged.transition ? 'Update' : 'Apply'} Restricted Free Agent Tag`
      })

      if (status.tagged.transition && !status.tagged.transition_announced) {
        add({
          key: 'transition-remove',
          onClick: handleRemoveTransitionTag,
          label: 'Remove Restricted Free Agent Tag'
        })

        if (status.tagged.transition_nominated) {
          add({
            key: 'transition-nomination',
            onClick: handle_unnominate_restricted_free_agent,
            label: 'Remove As Next Nominee'
          })
        } else {
          add({
            key: 'transition-nomination',
            onClick: handle_nominate_restricted_free_agent,
            label: 'Designate as Next RFA Nominee'
          })
        }
      }
    } else if (status.eligible.transitionBid) {
      add({
        key: 'transition',
        onClick: handleTransitionTag,
        label: 'Update Restricted Free Agent Tag'
      })
    }

    if (constants.season.isOffseason && status.eligible.rookieTag) {
      add({
        key: 'rookie',
        onClick: status.tagged.rookie ? handleRemoveTag : handleRookieTag,
        label: `${status.tagged.rookie ? 'Remove' : 'Apply'} Rookie Tag`
      })
    }

    if (
      constants.season.isOffseason &&
      status.active &&
      !status.tagged.transition
    ) {
      add({
        key: 'cutlist',
        onClick: handleCutlist,
        label: `${isOnCutlist ? 'Remove from' : 'Add to'} Cutlist`
      })
    }

    add({
      key: 'ir',
      onClick: handleReserveIR,
      disabled: !status.reserve.ir || (status.locked && status.starter),
      label: 'Move to Reserve/IR'
    })

    if (status.reserve.ir_long_term) {
      add({
        key: 'ir_long_term',
        onClick: handleReserveIRLongTerm,
        disabled: status.locked && status.starter,
        label: 'Move to Reserve/IR (Long Term)'
      })
    }

    add({
      key: 'cov',
      onClick: handleReserveCOV,
      disabled: !status.reserve.cov || (status.locked && status.starter),
      label: 'Move to Reserve/COV'
    })

    add({
      key: 'release',
      onClick: handleRelease,
      disabled: status.protected || (status.locked && status.starter),
      label: 'Release'
    })
  } else if (poachId) {
    add({
      key: 'update-poach',
      onClick: handlePoach,
      label: 'Update Poach'
    })
  } else if (!status.fa) {
    if (status.eligible.transitionBid) {
      add({
        key: 'transition',
        onClick: handleTransitionTag,
        label: `${status.restricted_free_agent_bid_exists ? 'Update' : 'Place'} Restricted Free Agent Bid`
      })

      if (status.restricted_free_agent_bid_exists) {
        add({
          key: 'transition-remove',
          onClick: handleRemoveTransitionTag,
          label: 'Remove Restricted Free Agent Bid'
        })
      }
    }

    const text = status.waiver.poach
      ? 'Submit Poaching Waiver Claim'
      : 'Submit Poaching Claim'

    add({
      key: 'poach',
      onClick: handlePoach,
      disabled: !status.eligible.poach && !status.waiver.poach,
      label: text
    })
  } else {
    // player is a free agent

    if (isNominating) {
      add({
        key: 'nominate',
        onClick: handleNominate,
        label: 'Select For Nomination'
      })
    }

    if (status.waiver.practice) {
      add({
        key: 'waiver',
        onClick: handleWaiver,
        label: 'Submit Practice Squad Waiver'
      })
    } else if (status.sign.practice) {
      add({
        key: 'sign-ps',
        onClick: () => handleAdd({ practice: true }),
        label: 'Sign To Practice Squad'
      })
    }

    if (status.waiver.active) {
      add({
        key: 'waiver',
        onClick: handleWaiver,
        label: 'Submit Active Roster Waiver'
      })
    } else if (status.sign.active) {
      add({
        key: 'sign-active',
        onClick: handleAdd,
        label: 'Sign to Active Roster'
      })
    }
  }

  if (buttonGroup && items.length === 0) {
    return null
  }

  return buttonGroup ? (
    <ButtonGroup variant='contained'>{items}</ButtonGroup>
  ) : (
    <MenuList>{items}</MenuList>
  )
}

PlayerContextMenu.propTypes = {
  playerMap: ImmutablePropTypes.map,
  status: PropTypes.object,
  hide: PropTypes.func,
  showConfirmation: PropTypes.func,
  cancelClaim: PropTypes.func,
  reserve: PropTypes.func,
  release: PropTypes.func,
  protect: PropTypes.func,
  waiverId: PropTypes.number,
  poachId: PropTypes.number,
  toggle_cutlist: PropTypes.func,
  isOnCutlist: PropTypes.bool,
  hideDisabled: PropTypes.bool,
  buttonGroup: PropTypes.bool,
  isNominating: PropTypes.bool,
  nominate_pid: PropTypes.func,
  nominate_restricted_free_agent: PropTypes.func,
  unnominate_restricted_free_agent: PropTypes.func
}
