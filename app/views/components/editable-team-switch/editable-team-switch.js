import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Switch from '@material-ui/core/Switch'

export default class EditableTeamSwitch extends React.Component {
  constructor(props) {
    super(props)

    const { team, field } = props
    const value = team[field]
    this.state = { checked: Boolean(value) }
  }

  handleChange = (event) => {
    const { field } = this.props
    const { checked } = event.target
    this.setState({ checked })
    this.props.onchange({ field, value: checked ? 1 : 0 })
  }

  render = () => {
    return (
      <div className='settings__switch'>
        <div className='settings__switch-body'>
          <div className='settings__switch-body-label'>{this.props.label}</div>
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

EditableTeamSwitch.propTypes = {
  team: ImmutablePropTypes.record,
  field: PropTypes.string,
  onchange: PropTypes.func,
  label: PropTypes.string,
  description: PropTypes.string
}
