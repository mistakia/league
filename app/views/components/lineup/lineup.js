import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Grid from '@mui/material/Grid'
import { Map } from 'immutable'

import { Roster } from '@libs-shared'
import PlayerSlot from '@components/player-slot'

import './lineup.styl'
import { roster_slot_types } from '@constants'

export default class Lineup extends React.Component {
  constructor(props) {
    super(props)

    this.state = { selected_player_slot: null }
  }

  handleSelect = (selected_player_slot) => {
    this.setState({ selected_player_slot })
  }

  handleUpdate = ({ slot, player_map = new Map() }) => {
    const players = [{ slot, pid: this.state.selected_player_slot.pid }]
    const pid = player_map.get('pid')
    if (pid) {
      const { league, roster } = this.props
      const r = new Roster({ roster: roster.toJS(), league })
      const selectedSlot = this.state.selected_player_slot.slot
      const slot = r.isEligibleForSlot({
        slot: selectedSlot,
        pos: player_map.get('pos')
      })
        ? selectedSlot
        : roster_slot_types.BENCH
      players.push({
        pid,
        slot
      })
    }
    this.props.update(players)
    this.setState({ selected_player_slot: null })
  }

  render = () => {
    const { league, roster } = this.props
    const { selected_player_slot } = this.state
    const { handleSelect, handleUpdate } = this
    const slotProps = {
      roster,
      selected_player_slot,
      handleSelect,
      handleUpdate
    }

    const r = new Roster({ roster: roster.toJS(), league })

    const starters = []
    if (league.sqb) {
      const slot = roster_slot_types.QB
      const rosterPlayers = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sqb; i++) {
        const { pid } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ pid, slot, ...slotProps }} />
        )
      }
    }

    if (league.srb) {
      const slot = roster_slot_types.RB
      const rosterPlayers = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.srb; i++) {
        const { pid } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ pid, slot, ...slotProps }} />
        )
      }
    }

    if (league.swr) {
      const slot = roster_slot_types.WR
      const rosterPlayers = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.swr; i++) {
        const { pid } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ pid, slot, ...slotProps }} />
        )
      }
    }

    if (league.srbwr) {
      const slot = roster_slot_types.RBWR
      const rosterPlayers = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.srbwr; i++) {
        const { pid } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ pid, slot, ...slotProps }} />
        )
      }
    }

    if (league.srbwrte) {
      const slot = roster_slot_types.RBWRTE
      const rosterPlayers = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.srbwrte; i++) {
        const { pid } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ pid, slot, ...slotProps }} />
        )
      }
    }

    if (league.sqbrbwrte) {
      const slot = roster_slot_types.QBRBWRTE
      const rosterPlayers = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sqbrbwrte; i++) {
        const { pid } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ pid, slot, ...slotProps }} />
        )
      }
    }

    if (league.swrte) {
      const slot = roster_slot_types.WRTE
      const rosterPlayers = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.swrte; i++) {
        const { pid } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ pid, slot, ...slotProps }} />
        )
      }
    }

    if (league.ste) {
      const slot = roster_slot_types.TE
      const rosterPlayers = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.ste; i++) {
        const { pid } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ pid, slot, ...slotProps }} />
        )
      }
    }

    if (league.sk) {
      const slot = roster_slot_types.K
      const rosterPlayers = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sk; i++) {
        const { pid } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ pid, slot, ...slotProps }} />
        )
      }
    }

    if (league.sdst) {
      const slot = roster_slot_types.DST
      const rosterPlayers = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sdst; i++) {
        const { pid } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ pid, slot, ...slotProps }} />
        )
      }
    }

    const bench = []
    if (
      selected_player_slot &&
      selected_player_slot.slot !== roster_slot_types.BENCH
    ) {
      bench.push(
        <PlayerSlot
          key='bench'
          {...{ pid: null, slot: roster_slot_types.BENCH, ...slotProps }}
        />
      )
    }
    for (const { slot, pid } of r.bench) {
      bench.push(<PlayerSlot key={pid} {...{ pid, slot, ...slotProps }} />)
    }

    return (
      <Grid container spacing={1} classes={{ root: 'lineup' }}>
        <Grid item xs={12} md={6}>
          <div className='lineup__starters'>
            <div className='dashboard__section-body empty'>{starters}</div>
          </div>
        </Grid>
        <Grid item xs={12} md={6}>
          <div className='dashboard__section-body empty'>{bench}</div>
        </Grid>
      </Grid>
    )
  }
}

Lineup.propTypes = {
  league: PropTypes.object,
  roster: ImmutablePropTypes.record,
  update: PropTypes.func
}
