import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Paper from '@mui/material/Paper'
import MenuItem from '@mui/material/MenuItem'
import MenuList from '@mui/material/MenuList'
import Button from '@mui/material/Button'
import ButtonGroup from '@mui/material/ButtonGroup'

import { constants } from '@libs-shared'

export default class PlayerContextMenu extends React.Component {
  handleDeactivate = () => {
    const { playerMap } = this.props
    this.props.showConfirmation({
      id: 'DEACTIVATE',
      data: {
        playerMap,
        pid: playerMap.get('pid')
      }
    })
    this.props.hide()
  }

  handleProtect = () => {
    const { playerMap, protect } = this.props
    this.props.showConfirmation({
      title: 'Designate Protected',
      description: `${playerMap.get('fname')} ${playerMap.get(
        'lname'
      )} (${playerMap.get(
        'pos'
      )}) will be designated as protected. This will protect the player from poaches but you will not be able to activate or release this player until the off-season.`,
      onConfirm: () => protect(playerMap.get('pid'))
    })
    this.props.hide()
  }

  handleActivate = () => {
    const { playerMap } = this.props
    this.props.showConfirmation({
      id: 'ACTIVATE',
      data: {
        playerMap
      }
    })
    this.props.hide()
  }

  handleWaiver = () => {
    const { playerMap } = this.props
    this.props.showConfirmation({
      id: 'WAIVER',
      data: {
        playerMap
      }
    })
    this.props.hide()
  }

  handleCancelWaiver = () => {
    const { playerMap, waiverId, cancelClaim } = this.props
    this.props.showConfirmation({
      title: 'Cancel claim',
      description: `Your claim for ${playerMap.get('fname')} ${playerMap.get(
        'lname'
      )} (${playerMap.get('pos')}) will no longer be processed.`,
      onConfirm: () => cancelClaim(waiverId)
    })
    this.props.hide()
  }

  handleUpdateWaiver = () => {
    const { playerMap, waiverId } = this.props
    this.props.showConfirmation({
      id: 'WAIVER',
      data: {
        waiverId,
        playerMap
      }
    })
    this.props.hide()
  }

  handlePoach = () => {
    const { playerMap, poachId } = this.props
    this.props.showConfirmation({
      id: 'POACH',
      data: {
        playerMap,
        poachId
      }
    })
    this.props.hide()
  }

  handleAdd = ({ practice = false } = {}) => {
    const { playerMap } = this.props
    this.props.showConfirmation({
      id: 'ADD_FREE_AGENT',
      data: {
        playerMap,
        practice
      }
    })
    this.props.hide()
  }

  handleReserveIR = () => {
    const { playerMap } = this.props
    this.props.showConfirmation({
      id: 'RESERVE',
      data: {
        playerMap
      }
    })
    this.props.hide()
  }

  handleReserveCOV = () => {
    const { playerMap, reserve } = this.props
    this.props.showConfirmation({
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
    this.props.hide()
  }

  handleRelease = () => {
    const { playerMap, release } = this.props
    this.props.showConfirmation({
      title: 'Release Player',
      description: `${playerMap.get('fname')} ${playerMap.get(
        'lname'
      )} (${playerMap.get(
        'pos'
      )}) will be released and placed on waivers for 24 hours before becoming a free agent.`,
      onConfirm: () => release(playerMap.get('pid'))
    })
    this.props.hide()
  }

  handleFranchiseTag = () => {
    const { playerMap } = this.props
    this.props.showConfirmation({
      id: 'FRANCHISE',
      data: {
        playerMap
      }
    })
    this.props.hide()
  }

  handleRookieTag = () => {
    const { playerMap } = this.props
    this.props.showConfirmation({
      id: 'ROOKIE',
      data: {
        playerMap
      }
    })
    this.props.hide()
  }

  handleRemoveTag = () => {
    const { playerMap } = this.props
    this.props.showConfirmation({
      id: 'REMOVE_TAG',
      data: {
        playerMap
      }
    })
    this.props.hide()
  }

  handleTransitionTag = () => {
    const { playerMap } = this.props
    this.props.showConfirmation({
      id: 'TRANSITION',
      data: {
        playerMap
      }
    })
    this.props.hide()
  }

  handleRemoveTransitionTag = () => {
    const { playerMap } = this.props
    this.props.showConfirmation({
      id: 'REMOVE_TRANSITION_TAG',
      data: {
        playerMap
      }
    })
    this.props.hide()
  }

  handleCutlist = () => {
    const pid = this.props.playerMap.get('pid')
    this.props.toggleCutlist(pid)
    this.props.hide()
  }

  render = () => {
    const {
      waiverId,
      status,
      isOnCutlist,
      poachId,
      hideDisabled,
      buttonGroup
    } = this.props

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
        onClick: this.handleUpdateWaiver,
        label: 'Update Claim'
      })

      add({
        key: 'cancel-waiver',
        onClick: this.handleCancelWaiver,
        label: 'Cancel Claim'
      })
    } else if (status.rostered) {
      add({
        key: 'activate',
        onClick: this.handleActivate,
        disabled: status.protected || !status.eligible.activate,
        label: 'Activate'
      })

      add({
        key: 'ps',
        onClick: this.handleDeactivate,
        disabled: !status.eligible.ps,
        label: 'Move to Practice Squad'
      })

      add({
        key: 'protect',
        onClick: this.handleProtect,
        disabled: !status.eligible.protect,
        label: 'Designate Protected'
      })

      if (constants.season.isOffseason && status.eligible.franchiseTag) {
        add({
          key: 'franchise',
          onClick: status.tagged.franchise
            ? this.handleRemoveTag
            : this.handleFranchiseTag,
          label: `${status.tagged.franchise ? 'Remove' : 'Apply'} Franchise Tag`
        })
      }

      if (constants.season.isOffseason && status.eligible.transitionTag) {
        add({
          key: 'transition',
          onClick: this.handleTransitionTag,
          label: `${
            status.tagged.transition ? 'Update' : 'Apply'
          } Transition Tag`
        })

        if (status.tagged.transition) {
          add({
            key: 'transition-remove',
            onClick: this.handleRemoveTransitionTag,
            label: 'Remove Transition Tag'
          })
        }
      } else if (status.eligible.transitionBid) {
        add({
          key: 'transition',
          onClick: this.handleTransitionTag,
          label: 'Update Transition Tag'
        })
      }

      if (constants.season.isOffseason && status.eligible.rookieTag) {
        add({
          key: 'rookie',
          onClick: status.tagged.rookie
            ? this.handleRemoveTag
            : this.handleRookieTag,
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
          onClick: this.handleCutlist,
          label: `${isOnCutlist ? 'Remove from' : 'Add to'} Cutlist`
        })
      }

      add({
        key: 'ir',
        onClick: this.handleReserveIR,
        disabled: !status.reserve.ir || (status.locked && status.starter),
        label: 'Move to Reserve/IR'
      })

      add({
        key: 'cov',
        onClick: this.handleReserveCOV,
        disabled: !status.reserve.cov || (status.locked && status.starter),
        label: 'Move to Reserve/COV'
      })

      add({
        key: 'release',
        onClick: this.handleRelease,
        disabled: status.protected || (status.locked && status.starter),
        label: 'Release'
      })
    } else if (poachId) {
      add({
        key: 'update-poach',
        onClick: this.handlePoach,
        label: 'Update Poach'
      })
    } else if (!status.fa) {
      if (status.eligible.transitionBid) {
        add({
          key: 'transition',
          onClick: this.handleTransitionTag,
          label: `${status.bid ? 'Update' : 'Place'} Transition Bid`
        })

        if (status.bid) {
          add({
            key: 'transition-remove',
            onClick: this.handleRemoveTransitionTag,
            label: 'Remove Transition Bid'
          })
        }
      }

      const text = status.waiver.poach
        ? 'Submit Poaching Waiver Claim'
        : 'Submit Poaching Claim'

      add({
        key: 'poach',
        onClick: this.handlePoach,
        disabled: !status.eligible.poach,
        label: text
      })
    } else {
      // player is a free agent

      if (status.waiver.practice) {
        add({
          key: 'waiver',
          onClick: this.handleWaiver,
          label: 'Submit Practice Squad Waiver'
        })
      } else if (status.sign.practice) {
        add({
          key: 'sign-ps',
          onClick: () => this.handleAdd({ practice: true }),
          label: 'Sign To Practice Squad'
        })
      }

      if (status.waiver.active) {
        add({
          key: 'waiver',
          onClick: this.handleWaiver,
          label: 'Submit Active Roster Waiver'
        })
      } else if (status.sign.active) {
        add({
          key: 'sign-active',
          onClick: this.handleAdd,
          label: 'Sign to Active Roster'
        })
      }
    }

    return buttonGroup ? (
      <ButtonGroup variant='contained'>{items}</ButtonGroup>
    ) : (
      <Paper>
        <MenuList>{items}</MenuList>
      </Paper>
    )
  }
}

PlayerContextMenu.propTypes = {
  playerMap: ImmutablePropTypes.map,
  status: PropTypes.object,
  showContext: PropTypes.func,
  hide: PropTypes.func,
  showConfirmation: PropTypes.func,
  cancelClaim: PropTypes.func,
  reserve: PropTypes.func,
  release: PropTypes.func,
  protect: PropTypes.func,
  waiverId: PropTypes.number,
  poachId: PropTypes.number,
  toggleCutlist: PropTypes.func,
  isOnCutlist: PropTypes.bool,
  hideDisabled: PropTypes.bool,
  buttonGroup: PropTypes.bool
}
