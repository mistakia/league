import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Grid from '@material-ui/core/Grid'
import { Map } from 'immutable'

import { Roster, constants } from '@common'
import PlayerSlot from '@components/player-slot'

import './lineup.styl'

export default class Lineup extends React.Component {
  constructor(props) {
    super(props)

    this.state = { selectedPlayerMap: new Map() }
  }

  handleSelect = (selectedPlayerMap) => {
    this.setState({ selectedPlayerMap })
  }

  handleUpdate = ({ slot, playerMap }) => {
    const players = [{ slot, player: this.state.selectedPlayerMap.get('pid') }]
    const pid = playerMap.get('pid')
    if (pid) {
      const { league, roster } = this.props
      const r = new Roster({ roster: roster.toJS(), league })
      const selectedSlot = this.state.selectedPlayerMap.get('slot')
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
    this.setState({ selected: new Map() })
  }

  render = () => {
    const { league, roster } = this.props
    const { selectedPlayerMap } = this.state
    const { handleSelect, handleUpdate } = this
    const slotProps = { roster, selectedPlayerMap, handleSelect, handleUpdate }

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
        const { player } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot
            key={`${slot}${i}`}
            {...{ playerId: player, slot, ...slotProps }}
          />
        )
      }
    }

    if (league.srbwrte) {
      const slot = constants.slots.RBWRTE
      const rosterPlayers = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.srbwrte; i++) {
        const { player } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot
            key={`${slot}${i}`}
            {...{ playerId: player, slot, ...slotProps }}
          />
        )
      }
    }

    if (league.sqbrbwrte) {
      const slot = constants.slots.QBRBWRTE
      const rosterPlayers = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sqbrbwrte; i++) {
        const { player } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot
            key={`${slot}${i}`}
            {...{ playerId: player, slot, ...slotProps }}
          />
        )
      }
    }

    if (league.swrte) {
      const slot = constants.slots.WRTE
      const rosterPlayers = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.swrte; i++) {
        const { player } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot
            key={`${slot}${i}`}
            {...{ playerId: player, slot, ...slotProps }}
          />
        )
      }
    }

    if (league.ste) {
      const slot = constants.slots.TE
      const rosterPlayers = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.ste; i++) {
        const { player } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot
            key={`${slot}${i}`}
            {...{ playerId: player, slot, ...slotProps }}
          />
        )
      }
    }

    if (league.sk) {
      const slot = constants.slots.K
      const rosterPlayers = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sk; i++) {
        const { player } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot
            key={`${slot}${i}`}
            {...{ playerId: player, slot, ...slotProps }}
          />
        )
      }
    }

    if (league.sdst) {
      const slot = constants.slots.DST
      const rosterPlayers = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sdst; i++) {
        const { player } = rosterPlayers[i] || {}
        starters.push(
          <PlayerSlot
            key={`${slot}${i}`}
            {...{ playerId: player, slot, ...slotProps }}
          />
        )
      }
    }

    const bench = []
    const selectedSlot = selectedPlayerMap.get('slot')
    if (selectedSlot && selectedSlot !== constants.slots.BENCH) {
      bench.push(
        <PlayerSlot
          key='bench'
          {...{ playerId: null, slot: constants.slots.BENCH, ...slotProps }}
        />
      )
    }
    for (const { slot, player } of r.bench) {
      bench.push(
        <PlayerSlot
          key={player}
          {...{ playerId: player, slot, ...slotProps }}
        />
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
            <div className='dashboard__section-body empty'>{starters}</div>
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
            <div className='dashboard__section-body empty'>{bench}</div>
          </div>
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
