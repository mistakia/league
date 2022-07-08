import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import TextField from '@mui/material/TextField'

export default class EditableSource extends React.Component {
  constructor(props) {
    super(props)

    let value = 1
    if (
      typeof this.props.source.weight !== 'undefined' &&
      this.props.source.weight !== null
    ) {
      value = this.props.source.weight
    }

    this.defaultValue = value

    this.state = { value, invalid: false, helper: '' }
  }

  handleBlur = (event) => {
    const { value } = event.target
    if (!value || value < 0) {
      this.setState({ value: this.defaultValue })
      return
    }

    if (!this.state.invalid) {
      const data = { sourceId: this.props.source.uid, weight: value }
      this.props.update(data)
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
    const { source } = this.props
    return (
      <TextField
        label={`${source.name} Weight`}
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

EditableSource.propTypes = {
  update: PropTypes.func,
  source: ImmutablePropTypes.record
}
