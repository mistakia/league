import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Pickr from '@simonwep/pickr'
import Grid from '@mui/material/Grid'

import SettingsSection from '@components/settings-section'
import EditableSettingField from '@components/editable-setting-field'
import TeamImage from '@components/team-image'

import './settings-team.styl'

export default class SettingsTeam extends React.Component {
  constructor(props) {
    super(props)

    this.primaryRef = React.createRef()
    this.altRef = React.createRef()

    const { team } = this.props

    this.state = { pc: `#${team.pc}`, ac: `#${team.ac}` }
  }

  handleSubmit = (type) => {
    const teamId = this.props.team.uid
    const value = this.state[type].toString().substring(1)
    this.props.update({ teamId, field: type, value })
  }

  componentDidMount = () => {
    const options = {
      components: {
        // Main components
        preview: true,
        opacity: true,
        hue: true,

        // Input / output Options
        interaction: {
          hex: true,
          rgba: true,
          input: true,
          clear: true,
          save: true
        }
      }
    }

    this._pickrPrimary = new Pickr({
      el: this.primaryRef.current,
      default: this.state.pc,
      theme: 'nano',
      closeOnScroll: true,
      ...options
    })
      .on('change', (color) => this.setState({ pc: color.toHEXA() }))
      .on('save', () => this.handleSubmit('pc'))

    this._pickrAlt = new Pickr({
      el: this.altRef.current,
      default: this.state.ac,
      theme: 'nano',
      closeOnScroll: true,
      ...options
    })
      .on('change', (color) => this.setState({ ac: color.toHEXA() }))
      .on('save', () => this.handleSubmit('ac'))
  }

  componentWillUnmount = () => {
    this._pickrPrimary.destroyAndRemove()
    this._pickrAlt.destroyAndRemove()
  }

  onchange = (value) => {
    const teamId = this.props.team.uid
    this.props.update({ teamId, ...value })
  }

  render = () => {
    const { team } = this.props

    const props = { data: team, on_change: this.onchange }

    const title = 'Team'
    const description = 'Edit Name / Abbreviation / Logo'
    const body = (
      <>
        <EditableSettingField
          label='Team Name'
          field='name'
          limit={100}
          grid={{ xs: 12 }}
          {...props}
        />
        <EditableSettingField
          label='Abbreviation'
          field='abbrv'
          limit={5}
          {...props}
        />
        <EditableSettingField label='Logo (URL)' field='image' {...props} />
        <Grid xs={12} item container>
          <div className='settings__team-section team__brand'>
            <div
              className='team__brand-pc'
              style={{ backgroundColor: this.state.pc }}
            />
            <div
              className='team__brand-ac'
              style={{ backgroundColor: this.state.ac }}
            />
            <TeamImage tid={team.uid} />
            <div className='team__brand-colors'>
              <div ref={this.primaryRef} />
              <div ref={this.altRef} />
            </div>
          </div>
        </Grid>
      </>
    )

    return <SettingsSection defaultOpen {...{ title, description, body }} />
  }
}

SettingsTeam.propTypes = {
  team: ImmutablePropTypes.record,
  update: PropTypes.func
}
