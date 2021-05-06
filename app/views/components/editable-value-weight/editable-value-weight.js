import React from 'react'

import TextField from '@material-ui/core/TextField'

export default class EditableValueWeight extends React.Component {
  constructor(props) {
    super(props)

    let value = 1
    if (
      typeof this.props.weight !== 'undefined' &&
      this.props.weight !== null
    ) {
      value = this.props.weight
    }
    this.defaultValue = value

    this.state = {
      value: this.defaultValue,
      invalid: false,
      helper: ''
    }
  }

  handleBlur = (event) => {
    const { value } = event.target
    if (!value || value < 0) {
      this.setState({ value: this.defaultValue })
      return
    }

    if (!this.state.invalid) {
      this.props.update({
        type: this.props.type,
        value
      })
    } else {
      this.setState({ value: this.defaultValue })
    }
  }

  handleChange = (event) => {
    const { value } = event.target
    this.setState({ value })

    if (isNaN(value)) {
      return this.setState({
        invalid: true,
        helper: 'should be between 0.00 and 1.00'
      })
    }

    const int = parseFloat(value)
    if (int < 0 || int > 1) {
      this.setState({
        invalid: true,
        helper: 'should be between 0.00 and 1.00'
      })
    } else {
      this.setState({ invalid: false, helper: '' })
    }
  }

  render = () => {
    const { label } = this.props
    return (
      <TextField
        label={label}
        value={this.state.value}
        error={this.state.invalid}
        helperText={this.state.helper}
        onBlur={this.handleBlur}
        onChange={this.handleChange}
        size='small'
        variant='outlined'
      />
    )
  }
}
