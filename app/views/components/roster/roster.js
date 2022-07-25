import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import PlayerRosterRow from '@components/player-roster-row'
import { Roster as RosterBuilder, constants, nth } from '@common'
import TeamName from '@components/team-name'

import './roster.styl'

export default class Roster extends React.Component {
  render = () => {
    const { roster, league, team, teamId, ps_count_max } = this.props

    if (!roster) {
      return null
    }

    const r = new RosterBuilder({ roster: roster.toJS(), league })
    const showBid = teamId === roster.tid

    const rows = []
    if (league.sqb) {
      const slot = constants.slots.QB
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sqb; i++) {
        const { pid } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${slot}${i}`}
            {...{ pid, slot, roster, showBid }}
          />
        )
      }
    }

    if (league.srb) {
      const slot = constants.slots.RB
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.srb; i++) {
        const { pid } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${slot}${i}`}
            {...{ pid, slot, roster, showBid }}
          />
        )
      }
    }

    if (league.swr) {
      const slot = constants.slots.WR
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.swr; i++) {
        const { pid } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${slot}${i}`}
            {...{ pid, slot, roster, showBid }}
          />
        )
      }
    }

    if (league.srbwr) {
      const slot = constants.slots.RBWR
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.srbwr; i++) {
        const { pid } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${slot}${i}`}
            {...{ pid, slot, roster, showBid }}
          />
        )
      }
    }

    if (league.srbwrte) {
      const slot = constants.slots.RBWRTE
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.srbwrte; i++) {
        const { pid } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${slot}${i}`}
            {...{ pid, slot, roster, showBid }}
          />
        )
      }
    }

    if (league.sqbrbwrte) {
      const slot = constants.slots.QBRBWRTE
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sqbrbwrte; i++) {
        const { pid } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${slot}${i}`}
            {...{ pid, slot, roster, showBid }}
          />
        )
      }
    }

    if (league.swrte) {
      const slot = constants.slots.WRTE
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.swrte; i++) {
        const { pid } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${slot}${i}`}
            {...{ pid, slot, roster, showBid }}
          />
        )
      }
    }

    if (league.ste) {
      const slot = constants.slots.TE
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.ste; i++) {
        const { pid } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${slot}${i}`}
            {...{ pid, slot, roster, showBid }}
          />
        )
      }
    }

    if (league.sk) {
      const slot = constants.slots.K
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sk; i++) {
        const { pid } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${slot}${i}`}
            {...{ pid, slot, roster, showBid }}
          />
        )
      }
    }

    if (league.sdst) {
      const slot = constants.slots.DST
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sdst; i++) {
        const { pid } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${slot}${i}`}
            {...{ pid, slot, roster, showBid }}
          />
        )
      }
    }

    if (league.ps) {
      const slot = constants.slots.PS
      const players = r.practice
      for (let i = 0; i < ps_count_max; i++) {
        const { pid } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${slot}${i}`}
            {...{ pid, slot, roster, showBid }}
          />
        )
      }
    }

    if (league.ir) {
      const slot = constants.slots.IR
      const players = r.ir
      for (let i = 0; i < league.ir; i++) {
        const { pid } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${slot}${i}`}
            {...{ pid, slot, roster, showBid }}
          />
        )
      }
    }

    for (const { pid } of r.bench) {
      rows.push(
        <PlayerRosterRow
          key={pid}
          {...{ pid, slot: constants.slots.BENCH, roster, showBid }}
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
  league: PropTypes.object,
  teamId: PropTypes.number,
  ps_count_max: PropTypes.number
}
