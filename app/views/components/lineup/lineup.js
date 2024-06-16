import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Grid from '@mui/material/Grid'
import { Map } from 'immutable'

import { Roster, constants } from '@libs-shared'
import PlayerSlot from '@components/player-slot'

import './lineup.styl'

export default class Lineup extends React.Component {
  constructor(props) {
    super(props)

    this.state = { selected_player_slot: null }
  }

  handleSelect = (selected_player_slot) => {
    this.setState({ selected_player_slot })
  }

  handleUpdate = ({ slot, playerMap = new Map() }) => {
    const players = [{ slot, pid: this.state.selected_player_slot.pid }]
    const pid = playerMap.get('pid')
    if (pid) {
      const { league, roster } = this.props
      const r = new Roster({ roster: roster.toJS(), league })
      const selectedSlot = this.state.selected_player_slot.slot
      const slot = r.isEligibleForSlot({
        slot: selectedSlot,
        pos: playerMap.get('pos')
      })
        ? selectedSlot
        : constants.slots.BENCH
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
      const slot = constants.slots.QB
      const rosterPlayers = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sqb; i++) {
        const { pid } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ pid, slot, ...slotProps }} />
        )
      }
    }

    if (league.srb) {
      const slot = constants.slots.RB
      const rosterPlayers = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.srb; i++) {
        const { pid } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ pid, slot, ...slotProps }} />
        )
      }
    }

    if (league.swr) {
      const slot = constants.slots.WR
      const rosterPlayers = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.swr; i++) {
        const { pid } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ pid, slot, ...slotProps }} />
        )
      }
    }

    if (league.srbwr) {
      const slot = constants.slots.RBWR
      const rosterPlayers = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.srbwr; i++) {
        const { pid } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ pid, slot, ...slotProps }} />
        )
      }
    }

    if (league.srbwrte) {
      const slot = constants.slots.RBWRTE
      const rosterPlayers = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.srbwrte; i++) {
        const { pid } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ pid, slot, ...slotProps }} />
        )
      }
    }

    if (league.sqbrbwrte) {
      const slot = constants.slots.QBRBWRTE
      const rosterPlayers = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sqbrbwrte; i++) {
        const { pid } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ pid, slot, ...slotProps }} />
        )
      }
    }

    if (league.swrte) {
      const slot = constants.slots.WRTE
      const rosterPlayers = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.swrte; i++) {
        const { pid } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ pid, slot, ...slotProps }} />
        )
      }
    }

    if (league.ste) {
      const slot = constants.slots.TE
      const rosterPlayers = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.ste; i++) {
        const { pid } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ pid, slot, ...slotProps }} />
        )
      }
    }

    if (league.sk) {
      const slot = constants.slots.K
      const rosterPlayers = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sk; i++) {
        const { pid } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ pid, slot, ...slotProps }} />
        )
      }
    }

    if (league.sdst) {
      const slot = constants.slots.DST
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
      selected_player_slot.slot !== constants.slots.BENCH
    ) {
      bench.push(
        <PlayerSlot
          key='bench'
          {...{ pid: null, slot: constants.slots.BENCH, ...slotProps }}
        />
      )
    }
    for (const { slot, pid } of r.bench) {
      bench.push(<PlayerSlot key={pid} {...{ pid, slot, ...slotProps }} />)
    }

    /* const ir = []
     * for (const { slot, pid } of r.ir) {
     *   ir.push(
     *     <PlayerSlot key={pid} {...{ pid, slot, roster }} />
     *   )
     * }

     * const ps = []
     * for (const { slot, pid } of r.practice) {
     *   ps.push(
     *     <PlayerSlot key={pid} {...{ pid, slot, roster }} />
     *   )
     * }
     */
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
