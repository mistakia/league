import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import MenuItem from '@material-ui/core/MenuItem'
import Select from '@material-ui/core/Select'
import InputLabel from '@material-ui/core/InputLabel'
import FormControl from '@material-ui/core/FormControl'

import { constants, Roster } from '@common'
import PlayerName from '@components/player-name'

import './auction-team-rosters.styl'

function RosterRow({ player = {}, slot }) {
  return (
    <div key={player.player} className='auction__team-rosters-player'>
      <div className='auction__team-rosters-player-slot'>{slot}</div>
      {player.player ? <PlayerName playerId={player.player} /> : '-'}
    </div>
  )
}

RosterRow.propTypes = {
  player: PropTypes.object,
  slot: PropTypes.string
}

export default class AuctonTeamRosters extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      tid: this.props.teamId
    }
  }

  handleChange = (event) => {
    this.setState({ tid: event.target.value })
  }

  render = () => {
    const { league } = this.props

    const menuItems = []
    for (const [index, team] of this.props.teams.entries()) {
      menuItems.push(
        <MenuItem key={index} value={team.uid}>
          {team.name}
        </MenuItem>
      )
    }

    const counts = {}
    const roster = this.props.rosters.find((r) => r.tid === this.state.tid)
    const rows = []
    const excludeSlots = [
      constants.slots.PS,
      constants.slots.PSP,
      constants.slots.IR,
      constants.slots.COV
    ]
    const players = roster
      ? roster
          .get('players')
          .filter((p) => !excludeSlots.includes(p.slot))
          .sort((a, b) => b.value - a.value)
          .toJS()
      : []

    for (const position of constants.positions) {
      counts[position] = players.filter((p) => p.pos === position).length
    }

    if (league.sqb) {
      for (let i = 0; i < league.sqb; i++) {
        const idx = players.findIndex((p) => p.pos === 'QB')
        const items = idx >= 0 ? players.splice(idx, 1) : []
        rows.push(
          <RosterRow key={`qb${i}`} {...{ player: items[0], slot: 'QB' }} />
        )
      }
    }

    if (league.srb) {
      for (let i = 0; i < league.srb; i++) {
        const idx = players.findIndex((p) => p.pos === 'RB')
        const items = idx >= 0 ? players.splice(idx, 1) : []
        rows.push(
          <RosterRow key={`rb${i}`} {...{ player: items[0], slot: 'RB' }} />
        )
      }
    }

    if (league.swr) {
      for (let i = 0; i < league.swr; i++) {
        const idx = players.findIndex((p) => p.pos === 'WR')
        const items = idx >= 0 ? players.splice(idx, 1) : []
        rows.push(
          <RosterRow key={`wr${i}`} {...{ player: items[0], slot: 'WR' }} />
        )
      }
    }

    if (league.srbwr) {
      for (let i = 0; i < league.srbwr; i++) {
        const positions = ['RB', 'WR']
        const idx = players.findIndex((p) => positions.includes(p.pos))
        const items = idx >= 0 ? players.splice(idx, 1) : []
        rows.push(
          <RosterRow
            key={`rbwr${i}`}
            {...{ player: items[0], slot: 'RB/WR' }}
          />
        )
      }
    }

    if (league.srbwrte) {
      for (let i = 0; i < league.srbwrte; i++) {
        const positions = ['RB', 'WR', 'TE']
        const idx = players.findIndex((p) => positions.includes(p.pos))
        const items = idx >= 0 ? players.splice(idx, 1) : []
        rows.push(
          <RosterRow
            key={`rbwrte${i}`}
            {...{ player: items[0], slot: 'FLEX' }}
          />
        )
      }
    }

    if (league.sqbrbwrte) {
      for (let i = 0; i < league.sqb; i++) {
        const positions = ['QB', 'RB', 'WR', 'TE']
        const idx = players.findIndex((p) => positions.includes(p.pos))
        const items = idx >= 0 ? players.splice(idx, 1) : []
        rows.push(
          <RosterRow
            key={`qbrbwrte${i}`}
            {...{ player: items[0], slot: 'SFLEX' }}
          />
        )
      }
    }

    if (league.ste) {
      for (let i = 0; i < league.ste; i++) {
        const idx = players.findIndex((p) => p.pos === 'TE')
        const items = idx >= 0 ? players.splice(idx, 1) : []
        rows.push(
          <RosterRow key={`te${i}`} {...{ player: items[0], slot: 'TE' }} />
        )
      }
    }

    if (league.sk) {
      for (let i = 0; i < league.sk; i++) {
        const idx = players.findIndex((p) => p.pos === 'K')
        const items = idx >= 0 ? players.splice(idx, 1) : []
        rows.push(
          <RosterRow key={`k${i}`} {...{ player: items[0], slot: 'K' }} />
        )
      }
    }

    if (league.sdst) {
      for (let i = 0; i < league.sdst; i++) {
        const idx = players.findIndex((p) => p.pos === 'DST')
        const items = idx >= 0 ? players.splice(idx, 1) : []
        rows.push(
          <RosterRow key={`dst${i}`} {...{ player: items[0], slot: 'DST' }} />
        )
      }
    }

    if (league.bench) {
      for (let i = 0; i < league.bench; i++) {
        const player = players.splice(0, 1)[0]
        rows.push(
          <RosterRow key={`bench${i}`} {...{ player, slot: 'BENCH' }} />
        )
      }
    }

    const countItems = []
    const r = roster ? new Roster({ roster, league }) : null
    countItems.push(
      <div key='avail' className='auction__team-rosters-footer-item'>
        <label>AVAIL</label>
        {r ? r.availableSpace : '-'}
      </div>
    )
    for (const position of constants.positions) {
      countItems.push(
        <div key={position} className='auction__team-rosters-footer-item'>
          <label>{position}</label>
          {counts[position] || '-'}
        </div>
      )
    }

    return (
      <div className='auction__team-rosters'>
        <div className='auction__team-rosters-header'>
          <FormControl size='small'>
            <InputLabel>Roster</InputLabel>
            <Select
              value={this.state.tid}
              onChange={this.handleChange}
              label='Roster'>
              {menuItems}
            </Select>
          </FormControl>
        </div>
        <div className='auction__team-rosters-body empty scroll'>{rows}</div>
        <div className='auction__team-rosters-footer'>{countItems}</div>
      </div>
    )
  }
}

AuctonTeamRosters.propTypes = {
  teamId: PropTypes.number,
  league: PropTypes.object,
  teams: ImmutablePropTypes.map,
  rosters: ImmutablePropTypes.map
}
