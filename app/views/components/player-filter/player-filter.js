import React from 'react'

import './player-filter.styl'

export default class PlayerFilter extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      visible: false
    }

    this.toggle = this.toggle.bind(this)
    this.click = this.click.bind(this)
  }

  toggle (event) {
    if (this.state.visible) {
      const wasOutsideBody = this.body ? !this.body.contains(event.target) : false
      if (wasOutsideBody) {
        document.removeEventListener('click', this.toggle)
        return this.setState({ visible: false })
      }
    } else {
      document.addEventListener('click', this.toggle)
      this.setState({ visible: true })
    }
  }

  click (index, event) {
    event.preventDefault()
    event.stopPropagation()
    const values = this.props.values.map(
      (v, i) => (index === i ? { ...v, selected: !v.selected } : v)
    )
    this.props.onChange(values)
  }

  render () {
    const { label, values, onChange } = this.props
    const { visible } = this.state

    const items = values.map((v, index) => {
      const classNames = ['player__filter-body-item']
      if (v.selected) classNames.push('selected')
      return (
        <div
          key={v.value}
          className={classNames.join(' ')}
          onClick={this.click.bind(null, index)}>
          {v.label}
        </div>
      )
    })

    const count = values.filter(v => v.selected).length
    const all = count === values.length
    const selectedLabel = all
      ? 'ALL'
      : values.filter(v => v.selected).map(v => v.label).join(', ')

    return (
      <div ref={ref => { this.root = ref }} className='player__filter' onClick={this.toggle}>
        <div className='player__filter-label'>{label}</div>
        <div className='player__filter-selection'>{selectedLabel}</div>
        { visible && <div ref={ref => { this.body = ref }} className='player__filter-body'>
          {items}
        </div>}
      </div>
    )
  }
}
