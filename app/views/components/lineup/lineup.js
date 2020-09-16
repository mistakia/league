import React from 'react'
import Grid from '@material-ui/core/Grid'

import { Roster, constants } from '@common'
import PlayerSlot from '@components/player-slot'

import './lineup.styl'

export default class Lineup extends React.Component {
  constructor (props) {
    super(props)

    this.state = { selected: null }
  }

  handleSelect = (selected) => {
    this.setState({ selected })
  }

  handleUpdate = ({ slot, player }) => {
    const players = [{ slot, player: this.state.selected.player }]
    if (player.player) {
      const { league, roster } = this.props
      const r = new Roster({ roster: roster.toJS(), league })
      const selectedSlot = this.state.selected.slot
      const slot = r.isEligibleForSlot({ slot: selectedSlot, pos: player.pos1 })
        ? selectedSlot
        : constants.slots.BENCH
      players.push({
        player: player.player,
        slot
      })
    }
    this.props.update(players)
    this.setState({ selected: null })
  }

  render = () => {
    const { league, roster } = this.props
    const { selected } = this.state
    const { handleSelect, handleUpdate } = this
    const slotProps = { roster, selected, handleSelect, handleUpdate }

    const r = new Roster({ roster: roster.toJS(), league })

    const starters = []
    if (league.sqb) {
      const slot = constants.slots.QB
      const players = r.starters.filter(p => p.slot === slot)
      for (let i = 0; i < league.sqb; i++) {
        const { player } = players[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ playerId: player, slot, ...slotProps }} />
        )
      }
    }

    if (league.srb) {
      const slot = constants.slots.RB
      const players = r.starters.filter(p => p.slot === slot)
      for (let i = 0; i < league.srb; i++) {
        const { player } = players[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ playerId: player, slot, ...slotProps }} />
        )
      }
    }

    if (league.swr) {
      const slot = constants.slots.WR
      const players = r.starters.filter(p => p.slot === slot)
      for (let i = 0; i < league.swr; i++) {
        const { player } = players[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ playerId: player, slot, ...slotProps }} />
        )
      }
    }

    if (league.srbwr) {
      const slot = constants.slots.RBWR
      const players = r.starters.filter(p => p.slot === slot)
      for (let i = 0; i < league.srbwr; i++) {
        const { player } = players[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ playerId: player, slot, ...slotProps }} />
        )
      }
    }

    if (league.srbwrte) {
      const slot = constants.slots.RBWRTE
      const players = r.starters.filter(p => p.slot === slot)
      for (let i = 0; i < league.srbwrte; i++) {
        const { player } = players[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ playerId: player, slot, ...slotProps }} />
        )
      }
    }

    if (league.sqbrbwrte) {
      const slot = constants.slots.QBRBWRTE
      const players = r.starters.filter(p => p.slot === slot)
      for (let i = 0; i < league.sqbrbwrte; i++) {
        const { player } = players[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ playerId: player, slot, ...slotProps }} />
        )
      }
    }

    if (league.swrte) {
      const slot = constants.slots.WRTE
      const players = r.starters.filter(p => p.slot === slot)
      for (let i = 0; i < league.swrte; i++) {
        const { player } = players[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ playerId: player, slot, ...slotProps }} />
        )
      }
    }

    if (league.ste) {
      const slot = constants.slots.TE
      const players = r.starters.filter(p => p.slot === slot)
      for (let i = 0; i < league.ste; i++) {
        const { player } = players[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ playerId: player, slot, ...slotProps }} />
        )
      }
    }

    if (league.sk) {
      const slot = constants.slots.K
      const players = r.starters.filter(p => p.slot === slot)
      for (let i = 0; i < league.sk; i++) {
        const { player } = players[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ playerId: player, slot, ...slotProps }} />
        )
      }
    }

    if (league.sdst) {
      const slot = constants.slots.DST
      const players = r.starters.filter(p => p.slot === slot)
      for (let i = 0; i < league.sdst; i++) {
        const { player } = players[i] || {}
        starters.push(
          <PlayerSlot key={`${slot}${i}`} {...{ playerId: player, slot, ...slotProps }} />
        )
      }
    }

    const bench = []
    if (selected && selected.slot !== constants.slots.BENCH) {
      bench.push(
        <PlayerSlot key='bench' {...{ playerId: null, slot: constants.slots.BENCH, ...slotProps }} />
      )
    }
    for (const { slot, player } of r.bench) {
      bench.push(
        <PlayerSlot key={player} {...{ playerId: player, slot, ...slotProps }} />
      )
    }

    /* const ir = []
     * for (const { slot, player } of r.ir) {
     *   ir.push(
     *     <PlayerSlot key={player} {...{ playerId: player, slot, roster }} />
     *   )
     * }

     * const ps = []
     * for (const { slot, player } of r.practice) {
     *   ps.push(
     *     <PlayerSlot key={player} {...{ playerId: player, slot, roster }} />
     *   )
     * }
     */
    return (
      <Grid container spacing={1} classes={{ root: 'lineup' }}>
        <Grid item xs={12} md={6}>
          <div className='section'>
            <div className='dashboard__section-body-header'>
              <div className='player__slot-slotName' />
              <div className='player__item-name' />
              {/* <div className='player__item-metric'>Opp</div>
                  <div className='player__item-metric'>Avg</div>
                  <div className='player__item-metric'>Proj</div>
                  <div className='player__item-metric'>Sos</div> */}
            </div>
            <div className='dashboard__section-body'>
              {starters}
            </div>
          </div>
        </Grid>
        <Grid item xs={12} md={6}>
          <div className='section'>
            <div className='dashboard__section-body-header'>
              <div className='player__slot-slotName' />
              <div className='player__item-name' />
              {/* <div className='player__item-metric'>Opp</div>
                  <div className='player__item-metric'>Avg</div>
                  <div className='player__item-metric'>Proj</div>
                  <div className='player__item-metric'>Sos</div> */}
            </div>
            <div className='dashboard__section-body empty'>
              {bench}
            </div>
          </div>
        </Grid>
      </Grid>
    )
  }
}
