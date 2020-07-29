import React from 'react'

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

  handleUpdate = ({ slot }) => {
    this.props.update({ slot, player: this.state.selected.player })
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

    const ir = []
    for (const { slot, player } of r.ir) {
      ir.push(
        <PlayerSlot key={player} {...{ playerId: player, slot, roster }} />
      )
    }

    const ps = []
    for (const { slot, player } of r.practice) {
      ps.push(
        <PlayerSlot key={player} {...{ playerId: player, slot, roster }} />
      )
    }

    return (
      <div className='lineup'>
        <div className='lineup__header'>
          {/* TODO */}
        </div>
        <div className='lineup__body'>
          <div className='lineup__starters'>
            <div className='dashboard__section'>
              <div className='dashboard__section-header'>
                <div className='dashboard__section-body-header'>
                  <div className='player__slot-slotName'>Slot</div>
                  <div className='player__item-name'>Name</div>
                  {/* <div className='player__item-metric'>Opp</div>
                      <div className='player__item-metric'>Avg</div>
                      <div className='player__item-metric'>Proj</div>
                      <div className='player__item-metric'>Sos</div> */}
                </div>
              </div>
              <div className='dashboard__section-body'>
                {starters}
              </div>
            </div>
          </div>
          <div className='lineup__inactive'>
            <div className='dashboard__section'>
              <div className='dashboard__section-header'>
                <div className='dashboard__section-body-header'>
                  <div className='player__slot-slotName'>Slot</div>
                  <div className='player__item-name'>Name</div>
                  {/* <div className='player__item-metric'>Opp</div>
                      <div className='player__item-metric'>Avg</div>
                      <div className='player__item-metric'>Proj</div>
                      <div className='player__item-metric'>Sos</div> */}
                </div>
              </div>
              <div className='dashboard__section-body empty'>
                {bench}
              </div>
            </div>
            {/* <div className='dashboard__section'>
                <div className='dashboard__section-header'>
                <div className='dashboard__section-body-header'>
                <div className='player__slot-slotName'>Slot</div>
                <div className='player__item-name'>Name</div>
                {<div className='player__item-metric'>Opp</div>
                <div className='player__item-metric'>Avg</div>
                <div className='player__item-metric'>Proj</div>
                <div className='player__item-metric'>Sos</div>}
                </div>
                </div>
                <div className='dashboard__section-body'>
                {ir}
                </div>
                </div>
                <div className='dashboard__section'>
                <div className='dashboard__section-header'>
                <div className='dashboard__section-body-header'>
                <div className='player__slot-slotName'>Slot</div>
                <div className='player__item-name'>Name</div>
                {<div className='player__item-metric'>Opp</div>
                <div className='player__item-metric'>Avg</div>
                <div className='player__item-metric'>Proj</div>
                <div className='player__item-metric'>Sos</div>}
                </div>
                </div>
                <div className='dashboard__section-body'>
                {ps}
                </div>
                </div> */}
          </div>
        </div>
      </div>
    )
  }
}
