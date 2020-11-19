import React from 'react'
import FormControl from '@material-ui/core/FormControl'
import Select from '@material-ui/core/Select'
import InputLabel from '@material-ui/core/InputLabel'
import MenuItem from '@material-ui/core/MenuItem'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogTitle from '@material-ui/core/DialogTitle'

import Button from '@components/button'
import { Roster, constants } from '@common'

export default class AddFreeAgentDialog extends React.Component {
  constructor (props) {
    super(props)

    const drops = []
    const { league, player, practice } = props
    const r = new Roster({ roster: props.roster.toJS(), league })

    if (practice) {
      props.rosterPlayers.practice.forEach(p => {
        if (p.slot === constants.slots.PSP) return
        const r = new Roster({ roster: props.roster.toJS(), league })
        r.removePlayer(p.player)
        if (r.hasOpenPracticeSquadSlot()) {
          drops.push(p)
        }
      })
    } else {
      props.rosterPlayers.active.forEach(p => {
        const r = new Roster({ roster: props.roster.toJS(), league })
        r.removePlayer(p.player)
        if (r.hasOpenBenchSlot(player.pos)) {
          drops.push(p)
        }
      })
    }

    this._isPlayerEligible = practice
      ? r.hasOpenPracticeSquadSlot()
      : r.hasOpenBenchSlot(player.pos)
    this._drops = drops
    this.state = { drop: '', error: false }
  }

  handleDrop = (event) => {
    const { value } = event.target
    this.setState({ drop: value, error: false })
  }

  handleSubmit = () => {
    const { player, practice } = this.props
    const { drop } = this.state

    if (!this._isPlayerEligible && !drop) {
      return this.setState({ error: true })
    }

    this.props.addFreeAgent({
      player: player.player,
      drop,
      slot: practice ? constants.slots.PS : constants.slots.BENCH
    })
    this.props.onClose()
  }

  render = () => {
    const { player, practice } = this.props

    const menuItems = []
    if (!this._isPlayerEligible) {
      for (const rPlayer of this._drops) {
        menuItems.push(
          <MenuItem
            key={rPlayer.player}
            value={rPlayer.player}
          >
            {rPlayer.name} ({rPlayer.pos})
          </MenuItem>
        )
      }
    }

    let text = `Sign ${player.name} (${player.pos}) to a salary of $0 and add them to the `
    if (practice) text += 'practice squad.'
    else text += 'active roster.'

    return (
      <Dialog open onClose={this.props.onClose}>
        <DialogTitle>Sign Free Agent</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {text}
          </DialogContentText>
          <div className='waiver__claim-inputs'>
            {!this._isPlayerEligible &&
              <FormControl size='small' variant='outlined'>
                <InputLabel id='drop-label'>Drop</InputLabel>
                <Select
                  labelId='drop-label'
                  value={this.state.drop}
                  onChange={this.handleDrop}
                  error={this.state.error}
                  label='Drop'
                >
                  {menuItems}
                </Select>
              </FormControl>}
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
