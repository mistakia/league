import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import Modal from '@components/modal'
import Button from '@components/button'
import { practice_squad_unprotected_slots, roster_slot_types } from '#constants'

export default function ReserveLongTermConfirmation({
  player_map,
  reserve,
  onClose
}) {
  const is_practice_squad_activation =
    practice_squad_unprotected_slots.includes(player_map.get('slot'))

  const handle_submit = () => {
    const reserve_pid = player_map.get('pid')
    reserve({ reserve_pid, slot: roster_slot_types.RESERVE_LONG_TERM })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        is_practice_squad_activation
          ? 'Activate & Designate Reserve/IR (Long Term)'
          : 'Designate Reserve/IR (Long Term)'
      }
      actions={
        <>
          <Button onClick={onClose} text>
            Cancel
          </Button>
          <Button onClick={handle_submit} text>
            Confirm
          </Button>
        </>
      }
    >
      <p>
        {`${player_map.get('first_name')} ${player_map.get('last_name')} (${player_map.get('primary_position')}) will be placed on Reserves/IR (Long Term). You will not be able to activate him until the offseason.`}
      </p>
      {is_practice_squad_activation && (
        <p>
          This activates him off the practice squad. He will no longer be
          practice squad eligible and can not be returned to the practice squad.
          No active roster space is required.
        </p>
      )}
    </Modal>
  )
}

ReserveLongTermConfirmation.propTypes = {
  onClose: PropTypes.func,
  reserve: PropTypes.func,
  player_map: ImmutablePropTypes.map
}
