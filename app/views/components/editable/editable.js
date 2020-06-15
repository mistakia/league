import React from 'react'

import './editable.styl'

export default class Editable extends React.Component {
  el = React.createRef()
  getEl = () => this.el.current

  commit = (value) => {
    if (!this.state.invalid) {
      let newProp = {}
      newProp[this.props.propName] = value
      this.setState({ loading: true, newValue: value })
      this.props.change(newProp)
    }
  }

  keyDown = (event) => {
    const el = this.getEl()
    if (!el) return

    if (event.keyCode === 13) { // enter
      el.blur()
    } else if (event.keyCode === 27) { // escape
      el.innerHTML = this.props.value
      el.blur()
    }
  }

  elementBlur = (event) => {
    const el = this.getEl()
    if (!el) return

    const value = el.innerHTML
    if (isNaN(value) || value < 0) {
      return el.innerHTML = this.props.value
    }

    if (value % 1 !== 0) {
      return el.innerHTML = this.props.value
    }

    const int = parseInt(value, 10)
    el.innerHTML = int

    if (value !== this.props.value) {
      this.props.onchange(int)
    }
  }

  makeClassString = () => {
    const classNames = ['editable']
    if (this.props.className) classNames.push(this.props.className)
    return classNames.join(' ')
  }

  render = () => {
    return <span
             ref={this.el}
             className={this.makeClassString()}
             onBlur={this.elementBlur}
             onKeyDown={this.keyDown}
             suppressContentEditableWarning={true}
             contentEditable
             {...this.props.defaultProps}>{this.props.value}</span>
  }
}
