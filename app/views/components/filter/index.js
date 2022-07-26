import React from 'react'
import PropTypes from 'prop-types'

import './filter.styl'

export default class Filter extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      visible: false
    }
  }

  handleToggleClick = (event) => {
    // ignore multiple events on same click
    if (this._timestamp && event.timeStamp === this._timestamp) {
      return
    }
    this._timestamp = event.timeStamp

    // close on PointerEvent outside of element
    if (event.constructor.name === 'PointerEvent') {
      const isOutside = this.body ? !this.body.contains(event.target) : false
      if (isOutside) {
        document.removeEventListener('click', this.handleToggleClick)
        this.setState({ visible: false })
      }

      return
    }

    if (this.state.visible) {
      document.removeEventListener('click', this.handleToggleClick)
      this.setState({ visible: false })
    } else {
      document.addEventListener('click', this.handleToggleClick)
      this.setState({ visible: true })
    }
  }

  handleAllClick = (event) => {
    this.props.filter(
      this.props.type,
      this.props.values.map((i) => i.value)
    )
  }

  handleClearClick = (event) => {
    this.props.filter(this.props.type, [])
  }

  handleClick = (event, index) => {
    event.preventDefault()
    event.stopPropagation()
    if (this.props.single) {
      return this.props.filter(this.props.type, [
        this.props.values[index].value
      ])
    }
    const values = this.props.values.map((v, i) =>
      index === i ? { ...v, selected: !v.selected } : v
    )
    const filteredValues = values.filter((i) => i.selected).map((i) => i.value)
    this.props.filter(this.props.type, filteredValues)
  }

  render = () => {
    const { label, values, single } = this.props
    const { visible } = this.state

    const items = values.map((v, index) => {
      const classNames = ['player__filter-dropdown-item']
      if (v.selected) classNames.push('selected')
      return (
        <div
          key={v.value}
          className={classNames.join(' ')}
          onClick={(e) => this.handleClick(e, index)}
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
        ref={(ref) => {
          this.root = ref
        }}
        className='player__filter'
        onClick={this.handleToggleClick}
      >
        <div className='player__filter-label'>{label}</div>
        <div className='player__filter-selection'>{selectedLabel}</div>
        {visible && (
          <div
            ref={(ref) => {
              this.body = ref
            }}
            className='player__filter-dropdown'
          >
            {!single && (
              <div className='player__filter-dropdown-head'>
                <div
                  className='player__filter-dropdown-action'
                  onClick={this.handleAllClick}
                >
                  All
                </div>
                <div
                  className='player__filter-dropdown-action'
                  onClick={this.handleClearClick}
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
}

Filter.propTypes = {
  filter: PropTypes.func,
  type: PropTypes.string,
  values: PropTypes.array,
  single: PropTypes.bool,
  label: PropTypes.string
}
