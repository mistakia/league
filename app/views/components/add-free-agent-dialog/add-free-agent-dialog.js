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
import { Roster, constants } from '@libs-shared'

export default class AddFreeAgentDialog extends React.Component {
  constructor(props) {
    super(props)

    const releases = []
    const { league, playerMap, practice } = props
    const r = new Roster({ roster: props.roster.toJS(), league })
    const pos = playerMap.get('pos')

    if (practice) {
      props.rosterPlayers.practice.forEach((practicePlayerMap) => {
        const slot = practicePlayerMap.get('slot')
        if (slot === constants.slots.PSP || slot === constants.slots.PSDP)
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
        if (r.hasOpenBenchSlot(pos)) {
          releases.push(activePlayerMap)
        }
      })
    }

    this._isPlayerEligible = practice
      ? r.hasOpenPracticeSquadSlot()
      : r.hasOpenBenchSlot(pos)
    this._releases = releases
    this.state = { release: [], error: false }
  }

  handleRelease = (event) => {
    const { value } = event.target
    this.setState({ release: value, error: false })
  }

  handleSubmit = () => {
    const { playerMap, practice } = this.props
    const { release } = this.state

    if (!this._isPlayerEligible && !release) {
      return this.setState({ error: true })
    }

    this.props.addFreeAgent({
      pid: playerMap.get('pid'),
      release,
      slot: practice ? constants.slots.PS : constants.slots.BENCH
    })
    this.props.onClose()
  }

  render = () => {
    const { playerMap, practice } = this.props

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

    let text = `Sign ${playerMap.get('name')} (${playerMap.get(
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
  playerMap: ImmutablePropTypes.map,
  practice: PropTypes.bool,
  roster: ImmutablePropTypes.record,
  rosterPlayers: PropTypes.object,
  addFreeAgent: PropTypes.func,
  onClose: PropTypes.func
}
