import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogTitle from '@mui/material/DialogTitle'

import Button from '@components/button'
import { Roster } from '@libs-shared'
import { roster_slot_types } from '@constants'

export default class AddFreeAgentDialog extends React.Component {
  constructor(props) {
    super(props)

    const releases = []
    const { league, player_map, practice } = props
    const r = new Roster({ roster: props.roster.toJS(), league })
    const pos = player_map.get('pos')

    if (practice) {
      props.rosterPlayers.practice.forEach((practicePlayerMap) => {
        const slot = practicePlayerMap.get('slot')
        if (slot === roster_slot_types.PSP || slot === roster_slot_types.PSDP)
          return
        const r = new Roster({ roster: props.roster.toJS(), league })
        r.removePlayer(practicePlayerMap.get('pid'))
        if (r.hasOpenPracticeSquadSlot()) {
          releases.push(practicePlayerMap)
        }
      })
    } else {
      props.rosterPlayers.active.forEach((activePlayerMap) => {
        const r = new Roster({ roster: props.roster.toJS(), league })
        r.removePlayer(activePlayerMap.get('pid'))
        if (r.has_bench_space_for_position(pos)) {
          releases.push(activePlayerMap)
        }
      })
    }

    this._isPlayerEligible = practice
      ? r.has_practice_squad_space_for_position(pos)
      : r.has_bench_space_for_position(pos)
    this._releases = releases
    this.state = { release: [], error: false }
  }

  handleRelease = (event) => {
    const { value } = event.target
    this.setState({ release: value, error: false })
  }

  handleSubmit = () => {
    const { player_map, practice } = this.props
    const { release } = this.state

    if (!this._isPlayerEligible && !release) {
      return this.setState({ error: true })
    }

    this.props.add_free_agent({
      pid: player_map.get('pid'),
      release,
      slot: practice ? roster_slot_types.PS : roster_slot_types.BENCH
    })
    this.props.onClose()
  }

  render = () => {
    const { player_map, practice } = this.props

    const menuItems = []
    if (!this._isPlayerEligible) {
      for (const releasePlayerMap of this._releases) {
        const pid = releasePlayerMap.get('pid')
        menuItems.push(
          <MenuItem key={pid} value={pid}>
            {releasePlayerMap.get('name')} ({releasePlayerMap.get('pos')})
          </MenuItem>
        )
      }
    }

    let text = `Sign ${player_map.get('name')} (${player_map.get(
      'pos'
    )}) to a salary of $0 and add them to the `
    if (practice) text += 'practice squad.'
    else text += 'active roster.'

    return (
      <Dialog open onClose={this.props.onClose}>
        <DialogTitle>Sign Free Agent</DialogTitle>
        <DialogContent>
          <DialogContentText>{text}</DialogContentText>
          <div className='confirmation__inputs'>
            {!this._isPlayerEligible && (
              <FormControl size='small' variant='outlined'>
                <InputLabel id='release-label'>Release</InputLabel>
                <Select
                  labelId='release-label'
                  value={this.state.release}
                  onChange={this.handleRelease}
                  error={this.state.error}
                  label='Release'
                >
                  {menuItems}
                </Select>
              </FormControl>
            )}
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={this.props.onClose} text>
            Cancel
          </Button>
          <Button onClick={this.handleSubmit} text>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    )
  }
}

AddFreeAgentDialog.propTypes = {
  league: PropTypes.object,
  player_map: ImmutablePropTypes.map,
  practice: PropTypes.bool,
  roster: ImmutablePropTypes.record,
  rosterPlayers: PropTypes.object,
  add_free_agent: PropTypes.func,
  onClose: PropTypes.func
}
