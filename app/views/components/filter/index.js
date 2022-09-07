import React, { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import PropTypes from 'prop-types'

import './filter.styl'

export default function Filter(props) {
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
    const values = props.values.map((i) => i.value)
    const { type } = props
    props.filter({ leagueId, type, values })
  }

  const handleClearClick = (event) => {
    props.filter({ leagueId, type: props.type, values: [] })
  }

  const handleSelect = (event, index) => {
    event.preventDefault()
    event.stopPropagation()
    if (props.single) {
      return props.filter({
        leagueId,
        type: props.type,
        values: [props.values[index].value]
      })
    }
    const values = props.values.map((v, i) =>
      index === i ? { ...v, selected: !v.selected } : v
    )
    const filteredValues = values.filter((i) => i.selected).map((i) => i.value)
    props.filter({ leagueId, type: props.type, values: filteredValues })
  }

  const { label, values, single } = props

  const items = values.map((v, index) => {
    const classNames = ['player__filter-dropdown-item']
    if (v.selected) classNames.push('selected')
    if (v.className) classNames.push(v.className)
    return (
      <div
        key={v.value}
        className={classNames.join(' ')}
        onClick={(e) => handleSelect(e, index)}
      >
        {v.label}
      </div>
    )
  })

  const count = values.filter((v) => v.selected).length
  const all = count === values.length
  const selectedLabel = all
    ? 'ALL'
    : values
        .filter((v) => v.selected)
        .map((v) => v.label)
        .join(', ')

  return (
    <div
      className='player__filter'
      onClick={handleToggleClick}
      ref={button_ref}
    >
      <div className='player__filter-label'>{label}</div>
      <div className='player__filter-selection'>{selectedLabel}</div>
      {visible && (
        <div ref={dropdown_ref} className='player__filter-dropdown'>
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
  label: PropTypes.string
}
