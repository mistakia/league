import React from 'react'

import TextField from '@material-ui/core/TextField'

export default class EditableLeagueField extends React.Component {
  constructor (props) {
    super(props)

    const { league, field } = this.props
    const value = league[field]

    this.state = { value }
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
      if (isNaN(value)) {
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

    if (value !== defaultValue) {
      this.props.onchange({ value, field })
    }
  }

  handleChange = (event) => {
    this.setState({ value: event.target.value })
  }

  render = () => {
    const { isCommish, isDefault, label } = this.props
    return (
      <TextField
        disabled={!isCommish && !isDefault}
        label={label}
        value={this.state.value}
        onBlur={this.handleBlur}
        onChange={this.handleChange}
        size='small'
        variant='outlined'
      />
    )
  }
}
