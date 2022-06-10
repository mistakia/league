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

function RosterRow({ rosterPlayer = {}, slot }) {
  return (
    <div key={rosterPlayer.player} className='auction__team-rosters-player'>
      <div className='auction__team-rosters-player-slot'>{slot}</div>
      {rosterPlayer.player ? (
        <PlayerName playerId={rosterPlayer.player} />
      ) : (
        '-'
      )}
    </div>
  )
}

RosterRow.propTypes = {
  rosterPlayer: PropTypes.object,
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
    this.props.teams.forEach((team, index) => {
      menuItems.push(
        <MenuItem key={index} value={team.uid}>
          {team.name}
        </MenuItem>
      )
    })

    const counts = {}
    const roster = this.props.rosters.find((r) => r.tid === this.state.tid)
    const rows = []
    const excludeSlots = [
      constants.slots.PS,
      constants.slots.PSP,
      constants.slots.IR,
      constants.slots.COV
    ]
    const rosterPlayers = roster
      ? roster
          .get('players')
          .filter((p) => !excludeSlots.includes(p.slot))
          .sort((a, b) => b.value - a.value)
          .toJS()
      : []

    for (const position of constants.positions) {
      counts[position] = rosterPlayers.filter((p) => p.pos === position).length
    }

    if (league.sqb) {
      for (let i = 0; i < league.sqb; i++) {
        const idx = rosterPlayers.findIndex((p) => p.pos === 'QB')
        const items = idx >= 0 ? rosterPlayers.splice(idx, 1) : []
        rows.push(
          <RosterRow
            key={`qb${i}`}
            {...{ rosterPlayer: items[0], slot: 'QB' }}
          />
        )
      }
    }

    if (league.srb) {
      for (let i = 0; i < league.srb; i++) {
        const idx = rosterPlayers.findIndex((p) => p.pos === 'RB')
        const items = idx >= 0 ? rosterPlayers.splice(idx, 1) : []
        rows.push(
          <RosterRow
            key={`rb${i}`}
            {...{ rosterPlayer: items[0], slot: 'RB' }}
          />
        )
      }
    }

    if (league.swr) {
      for (let i = 0; i < league.swr; i++) {
        const idx = rosterPlayers.findIndex((p) => p.pos === 'WR')
        const items = idx >= 0 ? rosterPlayers.splice(idx, 1) : []
        rows.push(
          <RosterRow
            key={`wr${i}`}
            {...{ rosterPlayer: items[0], slot: 'WR' }}
          />
        )
      }
    }

    if (league.srbwr) {
      for (let i = 0; i < league.srbwr; i++) {
        const positions = ['RB', 'WR']
        const idx = rosterPlayers.findIndex((p) => positions.includes(p.pos))
        const items = idx >= 0 ? rosterPlayers.splice(idx, 1) : []
        rows.push(
          <RosterRow
            key={`rbwr${i}`}
            {...{ rosterPlayer: items[0], slot: 'RB/WR' }}
          />
        )
      }
    }

    if (league.srbwrte) {
      for (let i = 0; i < league.srbwrte; i++) {
        const positions = ['RB', 'WR', 'TE']
        const idx = rosterPlayers.findIndex((p) => positions.includes(p.pos))
        const items = idx >= 0 ? rosterPlayers.splice(idx, 1) : []
        rows.push(
          <RosterRow
            key={`rbwrte${i}`}
            {...{ rosterPlayer: items[0], slot: 'FLEX' }}
          />
        )
      }
    }

    if (league.sqbrbwrte) {
      for (let i = 0; i < league.sqb; i++) {
        const positions = ['QB', 'RB', 'WR', 'TE']
        const idx = rosterPlayers.findIndex((p) => positions.includes(p.pos))
        const items = idx >= 0 ? rosterPlayers.splice(idx, 1) : []
        rows.push(
          <RosterRow
            key={`qbrbwrte${i}`}
            {...{ rosterPlayer: items[0], slot: 'SFLEX' }}
          />
        )
      }
    }

    if (league.ste) {
      for (let i = 0; i < league.ste; i++) {
        const idx = rosterPlayers.findIndex((p) => p.pos === 'TE')
        const items = idx >= 0 ? rosterPlayers.splice(idx, 1) : []
        rows.push(
          <RosterRow
            key={`te${i}`}
            {...{ rosterPlayer: items[0], slot: 'TE' }}
          />
        )
      }
    }

    if (league.sk) {
      for (let i = 0; i < league.sk; i++) {
        const idx = rosterPlayers.findIndex((p) => p.pos === 'K')
        const items = idx >= 0 ? rosterPlayers.splice(idx, 1) : []
        rows.push(
          <RosterRow key={`k${i}`} {...{ rosterPlayer: items[0], slot: 'K' }} />
        )
      }
    }

    if (league.sdst) {
      for (let i = 0; i < league.sdst; i++) {
        const idx = rosterPlayers.findIndex((p) => p.pos === 'DST')
        const items = idx >= 0 ? rosterPlayers.splice(idx, 1) : []
        rows.push(
          <RosterRow
            key={`dst${i}`}
            {...{ rosterPlayer: items[0], slot: 'DST' }}
          />
        )
      }
    }

    if (league.bench) {
      for (let i = 0; i < league.bench; i++) {
        const rosterPlayer = rosterPlayers.splice(0, 1)[0]
        rows.push(
          <RosterRow key={`bench${i}`} {...{ rosterPlayer, slot: 'BENCH' }} />
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
    constants.positions.forEach((position, index) => {
      countItems.push(
        <div key={index} className='auction__team-rosters-footer-item'>
          <label>{position}</label>
          {counts[position] || '-'}
        </div>
      )
    })

    return (
      <div className='auction__team-rosters'>
        <div className='auction__team-rosters-header'>
          <FormControl size='small'>
            <InputLabel>Roster</InputLabel>
            <Select
              value={this.state.tid}
              onChange={this.handleChange}
              label='Roster'
            >
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
