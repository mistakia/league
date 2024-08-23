import React, { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import PropTypes from 'prop-types'
import Checkbox from '@mui/material/Checkbox'

import './filter.styl'

export default function Filter({
  label,
  selected_label,
  single,
  body,
  values: filter_values = [],
  ...props
}) {
  const [visible, setVisible] = useState(false)
  const button_ref = useRef()
  const dropdown_ref = useRef()
  const { lid: leagueId } = useParams()

  let timestamp

  const handleOutsideClick = (event) => {
    // ignore multiple events on same click
    if (timestamp && event.timeStamp === timestamp) {
      return
    }
    timestamp = event.timeStamp

    const isInsideButton = button_ref.current
      ? button_ref.current.contains(event.target)
      : false
    const isOutsideDropdown = dropdown_ref.current
      ? !dropdown_ref.current.contains(event.target)
      : false

    if (isInsideButton) {
      handleToggleClick(event)
    } else if (isOutsideDropdown) {
      document.removeEventListener('click', handleOutsideClick)
      setVisible(false)
    }
  }

  const handleToggleClick = (event) => {
    // ignore multiple events on same click
    if (timestamp && event.timeStamp === timestamp) {
      return
    }
    timestamp = event.timeStamp

    const isInsideDropdown = dropdown_ref.current
      ? dropdown_ref.current.contains(event.target)
      : false

    if (isInsideDropdown) {
      return
    }

    if (visible) {
      document.removeEventListener('click', handleOutsideClick)
      setVisible(false)
    } else {
      document.addEventListener('click', handleOutsideClick)
      setVisible(true)
    }
  }

  const handleAllClick = (event) => {
    const values = filter_values.map((i) => i.value)
    const { type } = props
    props.filter({ leagueId, type, values })
  }

  const handleClearClick = (event) => {
    props.filter({ leagueId, type: props.type, values: [] })
  }

  const handleSelect = (event, index) => {
    event.preventDefault()
    event.stopPropagation()
    if (single) {
      return props.filter({
        leagueId,
        type: props.type,
        values: [filter_values[index].value]
      })
    }
    const values = filter_values.map((v, i) =>
      index === i ? { ...v, selected: !v.selected } : v
    )
    const filteredValues = values.filter((i) => i.selected).map((i) => i.value)
    props.filter({ leagueId, type: props.type, values: filteredValues })
  }

  const items = filter_values.map((v, index) => {
    const classNames = ['player__filter-dropdown-item']
    if (v.selected) classNames.push('selected')
    if (v.className) classNames.push(v.className)
    return (
      <div
        key={v.value}
        className={classNames.join(' ')}
        onClick={(e) => handleSelect(e, index)}
      >
        <Checkbox checked={v.selected} size='small' />
        {v.label}
      </div>
    )
  })

  const count = filter_values.filter((v) => v.selected).length
  const all = count === filter_values.length
  const default_selected_label = all
    ? 'ALL'
    : filter_values
        .filter((v) => v.selected)
        .map((v) => v.label)
        .join(', ')

  const default_body = (
    <>
      {!single && (
        <div className='player__filter-dropdown-head'>
          <div
            className='player__filter-dropdown-action'
            onClick={handleAllClick}
          >
            All
          </div>
          <div
            className='player__filter-dropdown-action'
            onClick={handleClearClick}
          >
            Clear
          </div>
        </div>
      )}
      <div className='player__filter-dropdown-body'>{items}</div>
    </>
  )

  return (
    <div
      className='player__filter'
      onClick={handleToggleClick}
      ref={button_ref}
    >
      <div className='player__filter-label'>{label}</div>
      <div className='player__filter-selection'>
        {selected_label || default_selected_label}
      </div>
      {visible && (
        <div ref={dropdown_ref} className='player__filter-dropdown'>
          {body || default_body}
        </div>
      )}
    </div>
  )
}

Filter.propTypes = {
  filter: PropTypes.func,
  type: PropTypes.string,
  values: PropTypes.array,
  single: PropTypes.bool,
  label: PropTypes.string,
  selected_label: PropTypes.string,
  body: PropTypes.node
}
