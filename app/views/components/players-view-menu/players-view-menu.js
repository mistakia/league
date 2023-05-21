import React, { useState, useRef, useEffect } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
// import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import PopperUnstyled from '@mui/base/PopperUnstyled'
import InputAdornment from '@mui/material/InputAdornment'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import ClickAwayListener from '@mui/material/ClickAwayListener'
import Paper from '@mui/material/Paper'

import { fuzzySearch } from '@core/utils'
import PlayersViewManager from '@components/players-view-manager'

import './players-view-menu.styl'

export default function PlayersViewMenu({
  select_players_view,
  selected_players_view,
  views
}) {
  const anchor_el = useRef()
  const [input_value, set_input_value] = useState()
  const [selected_value, set_selected_value] = useState(
    selected_players_view.name
  )
  const [manager_open, set_manager_open] = useState(false)
  const [popper_open, set_popper_open] = useState(false)

  useEffect(() => {
    set_selected_value(selected_players_view.name)
  }, [selected_players_view.name])

  const handleInputChange = (event) => {
    const { value } = event.target
    set_input_value(value)
  }
  const handleInputBlur = (event) => {
    set_input_value(undefined)
    set_selected_value(selected_players_view.name)
  }
  const handleInputFocus = (event) => {
    set_selected_value('')
    event.target.select()
    set_popper_open(true)
  }
  const handleSelect = (view) => (event) => {
    set_popper_open(false)
    select_players_view(view.key)
    set_input_value(undefined)
  }
  const handleClickAway = () => set_popper_open(false)
  const handleMangerClose = () => set_manager_open(false)
  /* const handleCreateClick = () => {
   *   set_popper_open(false)
   *   set_manager_open(true)
   * }
   */
  const filtered_views = input_value
    ? views.filter((view) => fuzzySearch(input_value, view.name))
    : views

  const filtered_items = filtered_views.toList().map((view, index) => (
    <li className='cursor' key={index} onClick={handleSelect(view)}>
      <Box>
        {view.name}
        <br />
        <span>{view.description}</span>
      </Box>
    </li>
  ))

  return (
    <>
      <ClickAwayListener onClickAway={handleClickAway}>
        <div className='players__view-menu'>
          <TextField
            label='View'
            autoComplete='off'
            placeholder='Filter views'
            value={
              typeof input_value === 'undefined' ? selected_value : input_value
            }
            onChange={handleInputChange}
            className='players__view-input'
            ref={anchor_el}
            InputProps={{
              onFocus: handleInputFocus,
              onBlur: handleInputBlur,
              endAdornment: (
                <InputAdornment position='end'>
                  <ArrowDropDownIcon />
                </InputAdornment>
              )
            }}
          />
          <PopperUnstyled
            className='players__view-popper'
            placement='bottom-start'
            open={popper_open}
            anchorEl={anchor_el.current}
          >
            <Paper>
              <ul className='players__view-list'>{filtered_items}</ul>
              {/* <div className='players__view-popper-footer'>
                  <Button variant='text' size='small' onClick={handleCreateClick}>
                  Create
                  </Button>
                  </div> */}
            </Paper>
          </PopperUnstyled>
        </div>
      </ClickAwayListener>
      <PlayersViewManager open={manager_open} handleClose={handleMangerClose} />
    </>
  )
}

PlayersViewMenu.propTypes = {
  select_players_view: PropTypes.func,
  selected_players_view: PropTypes.object,
  views: ImmutablePropTypes.map
}
