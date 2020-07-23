import React from 'react'

import TextField from '@material-ui/core/TextField'

export default class EditableLeagueField extends React.Component {
  constructor (props) {
    super(props)

    const { league, field } = this.props
    const value = league[field]

    this.state = { value, helperText: '', error: false }
  }

  handleBlur = (event) => {
    let { value } = event.target
    const { type, field, league } = this.props

    let defaultValue = league[field]

    if (!value) {
      this.setState({ value: defaultValue })
      return
    }

    if (type === 'int') {
      if (isNaN(value) || value % 1 !== 0) {
        this.setState({ value: defaultValue })
        return
      }

      value = parseInt(value, 10)
      defaultValue = parseInt(defaultValue, 10)
    } else if (type === 'float') {
      if (isNaN(value)) {
        this.setState({ value: defaultValue })
        return
      }

      value = parseFloat(value)
      defaultValue = parseFloat(defaultValue)
    }

    if (value !== defaultValue && !this.state.error) {
      this.props.onchange({ value, field })
    }
  }

  handleChange = (event) => {
    const { value } = event.target
    const { length, max, min } = this.props
    this.setState({ value })

    if (length && value.length > length) {
      return this.setState({ helperText: 'too long', error: true })
    }

    if (typeof max !== 'undefined' && value > max) {
      return this.setState({ helperText: `Max: ${max}`, error: true })
    }

    if (typeof min !== 'undefined' && value < min) {
      return this.setState({ helperText: `Min: ${min}`, error: true })
    }

    this.setState({ helperText: '', error: false })
  }

  render = () => {
    const { isCommish, isDefault, label } = this.props
    return (
      <TextField
        disabled={!isCommish && !isDefault}
        label={label}
        helperText={this.state.helperText}
        error={this.state.error}
        value={this.state.value}
        onBlur={this.handleBlur}
        onChange={this.handleChange}
        size='small'
        variant='outlined'
      />
    )
  }
}
