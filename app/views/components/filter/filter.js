import React, { Component } from 'react'
import FormGroup from '@material-ui/core/FormGroup'

import CheckboxItem from '@components/checkbox-item'

import './filter.styl'

class Filter extends Component {
  constructor (props) {
    super(props)
    this.state = {
      parentCheckboxChecked: false
    }

    this.handleParentCheckboxChange = this.handleParentCheckboxChange.bind(this)
    this.updateParentWithChildren = this.updateParentWithChildren.bind(this)
    this.handleChildCheckboxChange = this.handleChildCheckboxChange.bind(this)
    this.renderCheckboxes = this.renderCheckboxes.bind(this)
  }

  componentWillReceiveProps (nextProps) {
    this.updateParentWithChildren(nextProps)
  }

  componentWillMount () {
    this.updateParentWithChildren(this.props)
  }

  handleParentCheckboxChange (isChecked) {
    const { checkboxes, onChange } = this.props
    const newCheckState = checkboxes.map((aCheckbox) => ({
      ...aCheckbox,
      checked: isChecked
    }))
    onChange(newCheckState)
  }

  updateParentWithChildren (props) {
    const { checkboxes } = props
    let allChecked = false
    for (let i = 0; i < checkboxes.length; i += 1) {
      if (checkboxes[i].checked) {
        allChecked = true
      } else {
        allChecked = false
        break
      }
    }
    this.setState({
      parentCheckboxChecked: allChecked
    })
  }

  handleChildCheckboxChange (isChecked, index) {
    const { checkboxes } = this.props
    const { onChange } = this.props
    const newCheckState = checkboxes.map(
      (aCheckbox, i) => (index === i ? { ...aCheckbox, checked: isChecked } : aCheckbox)
    )
    onChange(newCheckState)
  }

  renderCheckboxes () {
    const { checkboxes } = this.props
    if (!checkboxes) {
      return null
    }
    return checkboxes.map((aCheckbox, index) => (
      <CheckboxItem
        key={index}
        checkboxLabel={aCheckbox.label}
        checkboxValue={aCheckbox.value}
        checked={aCheckbox.checked}
        onChange={(checkStatus) => this.handleChildCheckboxChange(checkStatus, index)}
      />
    ))
  }

  render () {
    const { parentCheckboxChecked } = this.state
    return (
      <div className='filter'>
        <FormGroup>
          <div className='filter-head'>
            <CheckboxItem
              checkboxLabel='All'
              checkboxValue='all'
              checked={parentCheckboxChecked}
              onChange={this.handleParentCheckboxChange}
            />
          </div>
          <div className='filter-children'>{this.renderCheckboxes()}</div>
        </FormGroup>
      </div>
    )
  }
}

export default Filter
