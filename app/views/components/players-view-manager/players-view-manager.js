import React, { useState } from 'react'
import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import Modal from '@mui/material/Modal'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Checkbox from '@mui/material/Checkbox'
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'

import './players-view-manager.styl'

const fields_grouping = {
  'Player Biography': [],
  'Week Projections': [
    'player_week_projected_points_added',
    'player_week_projected_points'
  ],
  'Season Projections': [
    'player_season_projected_points_added',
    'player_season_projected_points'
  ],
  'Rest of Season Projections': [
    'player_rest_of_season_projected_points_added',
    'player_rest_of_season_projected_points'
  ],
  'Stats By Play': {
    'Passing Stats By Play': {
      Production: ['stats.py', 'stats.tdp'],
      Efficiency: ['stats.pc_pct']
    },
    'Rushing Stats By Play': [],
    'Receiving Stats By Play': []
  }
}

function PlayerFieldGroup({ title, value, fields }) {
  const [open, set_open] = useState(false)

  const items = []
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const field = fields[item]
      items.push(
        <ListItem
          key={index}
          secondaryAction={<Checkbox edge='end' />}
          disablePadding
        >
          <ListItemButton className='players__view-manager-field'>
            <ListItemText primary={field.name} />
          </ListItemButton>
        </ListItem>
      )
    })
  } else {
    Object.keys(value).forEach((group_key, index) => {
      items.push(
        <PlayerFieldGroup
          key={index}
          title={group_key}
          value={value[group_key]}
          fields={fields}
        />
      )
    })
  }

  return (
    <Box>
      <ListItemButton onClick={() => set_open(!open)}>
        <ListItemText primary={title} />
        <KeyboardArrowDown
          sx={{
            mr: -1,
            transform: open ? 'rotate(-180deg)' : 'rotate(0)',
            transition: '0.2s'
          }}
        />
      </ListItemButton>
      {open && items}
    </Box>
  )
}

PlayerFieldGroup.propTypes = {
  title: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
  fields: PropTypes.object
}

export default function PlayersViewManager({ open, handleClose, fields }) {
  const items = []
  Object.keys(fields_grouping).forEach((group_key, index) => {
    items.push(
      <PlayerFieldGroup
        key={index}
        title={group_key}
        value={fields_grouping[group_key]}
        fields={fields}
      />
    )
  })

  return (
    <Modal open={open} onClose={handleClose}>
      <div className='players__view-modal'>
        <div className='players__view-modal-head' />
        <div className='players__view-modal-body'>
          <div className='players__view-manager-fields'>
            <div className='players__view-manager-fields-list'>{items}</div>
          </div>
          <div className='players__view-manager-order' />
        </div>
      </div>
    </Modal>
  )
}

PlayersViewManager.propTypes = {
  open: PropTypes.bool,
  handleClose: PropTypes.func,
  fields: PropTypes.object
}
