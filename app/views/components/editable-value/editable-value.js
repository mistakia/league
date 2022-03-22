import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import FormControl from '@material-ui/core/FormControl'
import Select from '@material-ui/core/Select'
import InputLabel from '@material-ui/core/InputLabel'
import MenuItem from '@material-ui/core/MenuItem'

import './editable-value.styl'

export default class EditableValue extends React.Component {
  constructor(props) {
    super(props)

    const { vbaseline } = this.props.app
    this.state = { vbaseline }
  }

  static getDerivedStateFromProps(props, state) {
    const { vbaseline } = props.app
    return { vbaseline }
  }

  handleChange = (event) => {
    const { value } = event.target
    this.setState({ vbaseline: value })
    this.props.update({ value, type: 'vbaseline' })
  }

  render = () => {
    const { vbaseline } = this.state
    return (
      <div className='editable__value'>
        <FormControl
          size='small'
          variant='outlined'
          className='editable__value-select'
        >
          <InputLabel id='value-label'>Value Baseline</InputLabel>
          <Select
            labelId='value-label'
            value={vbaseline}
            onChange={this.handleChange}
            label='VORP Baseline'
          >
            <MenuItem value='default'>Default</MenuItem>
            <MenuItem value='manual'>Manual</MenuItem>
          </Select>
        </FormControl>
      </div>
    )
  }
}

EditableValue.propTypes = {
  app: ImmutablePropTypes.record,
  update: PropTypes.func
}
