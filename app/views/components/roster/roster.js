import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import PlayerRosterRow from '@components/player-roster-row'
import { Roster as RosterBuilder, constants, nth } from '@common'
import TeamName from '@components/team-name'

import './roster.styl'

export default class Roster extends React.Component {
  render = () => {
    const { roster, league, team } = this.props

    if (!roster) {
      return null
    }

    const r = new RosterBuilder({ roster: roster.toJS(), league })

    const rows = []
    if (league.sqb) {
      const slot = constants.slots.QB
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sqb; i++) {
        const { player } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${slot}${i}`}
            {...{ playerId: player, slot, roster }}
          />
        )
      }
    }

    if (league.srb) {
      const slot = constants.slots.RB
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.srb; i++) {
        const { player } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${slot}${i}`}
            {...{ playerId: player, slot, roster }}
          />
        )
      }
    }

    if (league.swr) {
      const slot = constants.slots.WR
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.swr; i++) {
        const { player } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${slot}${i}`}
            {...{ playerId: player, slot, roster }}
          />
        )
      }
    }

    if (league.srbwr) {
      const slot = constants.slots.RBWR
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.srbwr; i++) {
        const { player } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${slot}${i}`}
            {...{ playerId: player, slot, roster }}
          />
        )
      }
    }

    if (league.srbwrte) {
      const slot = constants.slots.RBWRTE
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.srbwrte; i++) {
        const { player } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${slot}${i}`}
            {...{ playerId: player, slot, roster }}
          />
        )
      }
    }

    if (league.sqbrbwrte) {
      const slot = constants.slots.QBRBWRTE
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sqbrbwrte; i++) {
        const { player } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${slot}${i}`}
            {...{ playerId: player, slot, roster }}
          />
        )
      }
    }

    if (league.swrte) {
      const slot = constants.slots.WRTE
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.swrte; i++) {
        const { player } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${slot}${i}`}
            {...{ playerId: player, slot, roster }}
          />
        )
      }
    }

    if (league.ste) {
      const slot = constants.slots.TE
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.ste; i++) {
        const { player } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${slot}${i}`}
            {...{ playerId: player, slot, roster }}
          />
        )
      }
    }

    if (league.sk) {
      const slot = constants.slots.K
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sk; i++) {
        const { player } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${slot}${i}`}
            {...{ playerId: player, slot, roster }}
          />
        )
      }
    }

    if (league.sdst) {
      const slot = constants.slots.DST
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sdst; i++) {
        const { player } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${slot}${i}`}
            {...{ playerId: player, slot, roster }}
          />
        )
      }
    }

    if (league.ps) {
      const slot = constants.slots.PS
      const players = r.practice
      for (let i = 0; i < league.ps; i++) {
        const { player } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${slot}${i}`}
            {...{ playerId: player, slot, roster }}
          />
        )
      }
    }

    if (league.ir) {
      const slot = constants.slots.IR
      const players = r.ir
      for (let i = 0; i < league.ir; i++) {
        const { player } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${slot}${i}`}
            {...{ playerId: player, slot, roster }}
          />
        )
      }
    }

    for (const { player } of r.bench) {
      rows.push(
        <PlayerRosterRow
          key={player}
          {...{ playerId: player, slot: constants.slots.BENCH, roster }}
        />
      )
    }

    const picks = []
    for (const pick of team.picks) {
      const pickNum = pick.pick % league.nteams || league.nteams
      const pickStr = `${pick.round}.${('0' + pickNum).slice(-2)}`

      picks.push(
        <div>
          {pick.pick ? pickStr : `${pick.round}${nth(pick.round)}`}
          <div className='table__cell draft-pick__team'>
            <TeamName tid={pick.otid} abbrv />
          </div>
        </div>
      )
    }

    return (
      <div className='roster'>
        <div className='roster__team'>
          <TeamName tid={roster.tid} />
          <div className='roster__salary metric'>{`$${r.availableCap}`}</div>
        </div>
        <div className='roster__slots'>{rows}</div>
      </div>
    )
  }
}

Roster.propTypes = {
  roster: ImmutablePropTypes.record,
  team: ImmutablePropTypes.record,
  league: PropTypes.object
}
