import React from 'react'
import Switch from '@material-ui/core/Switch'

import './settings-switch.styl'

export default class SettingsSwitch extends React.Component {
  constructor (props) {
    super(props)

    const { app, field } = props
    const checked = !!app[field]
    this.state = { checked }
  }

  handleChange = (event) => {
    const { field } = this.props
    const { checked } = event.target
    this.setState({ checked })
    this.props.update({ type: field, value: checked ? 1 : 0 })
  }

  render = () => {
    return (
      <div className='settings__switch'>
        <div className='settings__switch-body'>
          <div className='settings__switch-body-label'>
            {this.props.label}
          </div>
          <div className='settings__switch-body-description'>
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
