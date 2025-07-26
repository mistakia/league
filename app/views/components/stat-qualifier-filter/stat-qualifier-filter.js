import React from 'react'
import PropTypes from 'prop-types'
import TextField from '@mui/material/TextField'

export default class StatQualifierFilter extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      value: this.props.qualifier.value,
      invalid: false,
      helper: ''
    }
  }

  static getDerivedStateFromProps(props, state) {
    return {
      value: props.qualifier.value,
      invalid: false,
      helper: ''
    }
  }

  handleChange = (event) => {
    const { value } = event.target
    this.setState({ value })

    if (isNaN(value) || Number(value) < 0) {
      return this.setState({
        invalid: true,
        helper: 'should be greater than 1'
      })
    } else {
      this.props.update({ qualifier: this.props.stat, value })
    }
  }

  render = () => {
    return (
      <TextField
        className='player__filter'
        label={`Min. ${this.props.qualifier.type.toUpperCase()}`}
        value={this.state.value}
        error={this.state.invalid}
        helperText={this.state.helper}
        onChange={this.handleChange}
        size='small'
        variant='outlined'
      />
    )
  }
}

StatQualifierFilter.propTypes = {
  qualifier: PropTypes.array,
  stat: PropTypes.array,
  update: PropTypes.func
}
