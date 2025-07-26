import React from 'react'
import PropTypes from 'prop-types'

import './editable.styl'

export default class Editable extends React.Component {
  el = React.createRef()
  getEl = () => this.el.current

  commit = (value) => {
    if (!this.state.invalid) {
      const newProp = {}
      newProp[this.props.propName] = value
      this.setState({ loading: true, newValue: value })
      this.props.change(newProp)
    }
  }

  handleKeyDown = (event) => {
    const el = this.getEl()
    if (!el) return

    if (event.keyCode === 13) {
      // enter
      el.blur()
    } else if (event.keyCode === 27) {
      // escape
      el.innerHTML = this.props.value
      el.blur()
    }
  }

  handleBlur = (event) => {
    const el = this.getEl()
    if (!el) return

    const { type, max } = this.props

    const value = el.innerHTML

    if (this.props.value && !value) {
      el.innerHTML = this.props.value
      return
    }

    if (type === 'number') {
      if (isNaN(value) || value < 0) {
        el.innerHTML = this.props.value
        return
      }

      if (value % 1 !== 0) {
        el.innerHTML = this.props.value
        return
      }

      const int = Number(value)
      if (max && int > max) {
        el.innerHTML = this.props.value
        return
      }

      el.innerHTML = int

      if (int !== this.props.value) {
        this.props.onchange(int)
      }
    } else {
      this.props.onchange(value)
    }
  }

  makeClassString = () => {
    const classNames = ['editable']
    if (this.props.className) classNames.push(this.props.className)
    return classNames.join(' ')
  }

  render = () => {
    if (this.props.disabled) {
      return <span className={this.props.className}>{this.props.value}</span>
    }

    return (
      <span
        ref={this.el}
        className={this.makeClassString()}
        onBlur={this.handleBlur}
        onKeyDown={this.handleKeyDown}
        suppressContentEditableWarning
        contentEditable
        {...this.props.defaultProps}
      >
        {this.props.value}
      </span>
    )
  }
}

Editable.propTypes = {
  disabled: PropTypes.bool,
  propName: PropTypes.string,
  change: PropTypes.func,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  type: PropTypes.string,
  max: PropTypes.number,
  onchange: PropTypes.func,
  className: PropTypes.string,
  defaultProps: PropTypes.object
}
