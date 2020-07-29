import React from 'react'
import Switch from '@material-ui/core/Switch'

import './editable-team-switch.styl'

export default class EditableTeamSwitch extends React.Component {
  constructor (props) {
    super(props)

    const { team, field } = props
    const value = team[field]
    this.state = { checked: !!value }
  }

  handleChange = (event) => {
    const { field } = this.props
    const { checked } = event.target
    this.setState({ checked })
    this.props.onchange({ field, value: checked ? 1 : 0 })
  }

  render = () => {
    return (
      <div className='editable__team-switch'>
        <div className='editable__team-switch-body'>
          <div className='editable__team-switch-body-label'>
            {this.props.label}
          </div>
          <div className='editable__team-switch-body-description'>
            {this.props.description}
          </div>
        </div>
        <Switch
          checked={this.state.checked}
          onChange={this.handleChange}
          color='primary'
        />
      </div>
    )
  }
}
