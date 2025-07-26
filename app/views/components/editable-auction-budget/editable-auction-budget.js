import React from 'react'
import PropTypes from 'prop-types'

import TextField from '@mui/material/TextField'

export default class EditableAuctionBudget extends React.Component {
  constructor(props) {
    super(props)

    this.state = { value: this.props.budget, invalid: false, helper: '' }
  }

  handleBlur = (event) => {
    if (!this.state.invalid) {
      this.props.set(this.state.value)
    } else {
      this.setState({ value: this.props.budget })
    }
  }

  handleChange = (event) => {
    const { value } = event.target
    this.setState({ value })

    if (isNaN(value)) {
      return this.setState({ invalid: true, helper: 'should be an integer' })
    }

    const int = Number(value)
    if (int < 0) {
      this.setState({ invalid: true, helper: 'should be a positive integer' })
    } else {
      this.setState({ invalid: false, helper: '' })
    }
  }

  render = () => {
    return (
      <TextField
        label='Starting Lineup Budget'
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

EditableAuctionBudget.propTypes = {
  budget: PropTypes.number,
  set: PropTypes.func
}
