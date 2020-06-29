import React from 'react'

import TextField from '@material-ui/core/TextField'

export default class EditableTeamField extends React.Component {
  constructor (props) {
    super(props)

    const { team, field } = this.props
    const value = team[field]

    this.state = { value, invalid: false, helper: '' }
  }

  handleBlur = (event) => {
    const { field, team } = this.props
    const { value } = event.target
    const defaultValue = team[field]

    if (!value) {
      this.setState({ value: defaultValue })
      return
    }

    if (field === 'abbrv' && value.length > 5) {
      return
    }

    if (value !== defaultValue) {
      this.props.onchange({ field, value })
    }
  }

  handleChange = (event) => {
    const { field } = this.props
    const { value } = event.target
    this.setState({ value })

    if (field === 'abbrv' && value.length > 5) {
      this.setState({ invalid: true, helper: 'too long' })
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
        onBlur={this.handleBlur}
        error={this.state.invalid}
        helperText={this.state.helper}
        onChange={this.handleChange}
        size='small'
        variant='outlined'
      />
    )
  }
}
