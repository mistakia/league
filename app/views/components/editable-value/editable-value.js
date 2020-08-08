import React from 'react'
import EditableValueWeight from '@components/editable-value-weight'
import FormControl from '@material-ui/core/FormControl'
import Select from '@material-ui/core/Select'
import InputLabel from '@material-ui/core/InputLabel'
import MenuItem from '@material-ui/core/MenuItem'

import './editable-value.styl'

export default class EditableValue extends React.Component {
  constructor (props) {
    super(props)

    const { vbaseline, vorpw, volsw } = this.props.app
    this.state = { vbaseline, vorpw, volsw }
  }

  static getDerivedStateFromProps (props, state) {
    const { vbaseline, vorpw, volsw } = props.app
    return { vbaseline, vorpw, volsw }
  }

  handleChange = (event) => {
    const { value } = event.target
    this.setState({ vbaseline: value })
    this.props.update({ value, type: 'vbaseline' })
  }

  render = () => {
    const { vbaseline, vorpw, volsw } = this.state
    const weights = (
      <div className='editable__value-weights'>
        <EditableValueWeight weight={vorpw} type='vorpw' label='Best Available Weight' />
        <EditableValueWeight weight={volsw} type='volsw' label='Worst Starter Weight' />
      </div>
    )
    return (
      <div className='editable__value'>
        <FormControl size='small' variant='outlined' className='editable__value-select'>
          <InputLabel id='value-label'>Value Baseline</InputLabel>
          <Select
            labelId='value-label'
            value={vbaseline}
            onChange={this.handleChange}
            label='VORP Baseline'
          >
            <MenuItem value='available'>Best Available</MenuItem>
            <MenuItem value='bench'>Average Bench</MenuItem>
            <MenuItem value='starter'>Worst Starter</MenuItem>
            <MenuItem value='average'>Average Starter</MenuItem>
            <MenuItem value='hybrid'>Hybrid</MenuItem>
            <MenuItem value='manual'>Manual</MenuItem>
          </Select>
        </FormControl>
        {vbaseline === 'hybrid' && weights}
      </div>
    )
  }
}
