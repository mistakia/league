import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { withStyles } from '@mui/styles'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import blue from '@mui/material/colors/blue'

const styles = {
  root: {
    color: blue[600],
    '&$checked': {
      color: blue[500]
    }
  },
  checked: {}
}

class CheckboxItem extends Component {
  constructor(props) {
    super(props)
    this.state = {}

    this.handleCheckboxChange = this.handleCheckboxChange.bind(this)
  }

  handleCheckboxChange(event) {
    this.props.onChange(event.target.checked)
  }

  render() {
    const { classes, checkboxValue, checkboxLabel, checked } = this.props
    return (
      <FormControlLabel
        control={
          <Checkbox
            checked={checked}
            onChange={this.handleCheckboxChange}
            value={checkboxValue}
            classes={{
              root: classes.root,
              checked: classes.checked
            }}
          />
        }
        label={checkboxLabel}
      />
    )
  }
}

export default withStyles(styles)(CheckboxItem)

CheckboxItem.propTypes = {
  onChange: PropTypes.func,
  classes: PropTypes.object.isRequired,
  checkboxLabel: PropTypes.string.isRequired,
  checkboxValue: PropTypes.string.isRequired,
  checked: PropTypes.bool.isRequired
}

CheckboxItem.defaultProps = {
  handleCheckboxChange: null
}
