import React from 'react'
import MenuItem from '@material-ui/core/MenuItem'
import Select from '@material-ui/core/Select'
import InputLabel from '@material-ui/core/InputLabel'
import FormControl from '@material-ui/core/FormControl'

import { constants } from '@common'
import PlayerName from '@components/player-name'

import './auction-team-rosters.styl'

export default class AuctonTeamRosters extends React.Component {
  constructor (props) {
    super(props)

    this.state = {
      tid: ''
    }
  }

  handleChange = (event) => {
    this.setState({ tid: event.target.value })
  }

  render = () => {
    const menuItems = []
    for (const [index, team] of this.props.teams.entries()) {
      menuItems.push(
        <MenuItem key={index} value={team.uid}>{team.name}</MenuItem>
      )
    }

    const playerItems = []
    const roster = this.props.rosters.find(r => r.tid === this.state.tid)
    if (roster) {
      const groups = {}
      for (const position of constants.positions) {
        if (!groups[position]) groups[position] = []
        groups[position] = roster.players.filter(p => p.pos === position)
      }

      for (const position in groups) {
        const players = groups[position]
        for (const player of players) {
          if (!player.player) continue
          playerItems.push(
            <div key={player.player} className='auction__team-rosters-player'>
              <PlayerName playerId={player.player} />
            </div>
          )
        }
      }
    }

    return (
      <div className='auction__team-rosters'>
        <FormControl size='small' variant='outlined'>
          <InputLabel>Roster</InputLabel>
          <Select
            value={this.state.tid}
            onChange={this.handleChange}
            label='Roster'
          >
            {menuItems}
          </Select>
        </FormControl>
        <div className='auction__team-rosters-body empty scroll'>
          {playerItems}
        </div>
      </div>
    )
  }
}
