import React from 'react'

import { constants } from '@common'
import ScoreboardPlayer from '@components/scoreboard-player'
import TeamName from '@components/team-name'
import TeamImage from '@components/team-image'

import './scoreboard-team.styl'

export default class ScoreboardTeam extends React.Component {
  render = () => {
    const { team, roster, league, type } = this.props

    const rows = []
    if (league.sqb) {
      const slot = constants.slots.QB
      const players = roster.starters.filter(p => p.slot === slot)
      for (let i = 0; i < league.sqb; i++) {
        const { player } = players[i] || {}
        rows.push(
          <ScoreboardPlayer key={`${slot}${i}`} {...{ playerId: player, slot, roster }} />
        )
      }
    }

    if (league.srb) {
      const slot = constants.slots.RB
      const players = roster.starters.filter(p => p.slot === slot)
      for (let i = 0; i < league.srb; i++) {
        const { player } = players[i] || {}
        rows.push(
          <ScoreboardPlayer key={`${slot}${i}`} {...{ playerId: player, slot, roster }} />
        )
      }
    }

    if (league.swr) {
      const slot = constants.slots.WR
      const players = roster.starters.filter(p => p.slot === slot)
      for (let i = 0; i < league.swr; i++) {
        const { player } = players[i] || {}
        rows.push(
          <ScoreboardPlayer key={`${slot}${i}`} {...{ playerId: player, slot, roster }} />
        )
      }
    }

    if (league.srbwr) {
      const slot = constants.slots.RBWR
      const players = roster.starters.filter(p => p.slot === slot)
      for (let i = 0; i < league.srbwr; i++) {
        const { player } = players[i] || {}
        rows.push(
          <ScoreboardPlayer key={`${slot}${i}`} {...{ playerId: player, slot, roster }} />
        )
      }
    }

    if (league.srbwrte) {
      const slot = constants.slots.RBWRTE
      const players = roster.starters.filter(p => p.slot === slot)
      for (let i = 0; i < league.srbwrte; i++) {
        const { player } = players[i] || {}
        rows.push(
          <ScoreboardPlayer key={`${slot}${i}`} {...{ playerId: player, slot, roster }} />
        )
      }
    }

    if (league.sqbrbwrte) {
      const slot = constants.slots.QBRBWRTE
      const players = roster.starters.filter(p => p.slot === slot)
      for (let i = 0; i < league.sqbrbwrte; i++) {
        const { player } = players[i] || {}
        rows.push(
          <ScoreboardPlayer key={`${slot}${i}`} {...{ playerId: player, slot, roster }} />
        )
      }
    }

    if (league.swrte) {
      const slot = constants.slots.WRTE
      const players = roster.starters.filter(p => p.slot === slot)
      for (let i = 0; i < league.swrte; i++) {
        const { player } = players[i] || {}
        rows.push(
          <ScoreboardPlayer key={`${slot}${i}`} {...{ playerId: player, slot, roster }} />
        )
      }
    }

    if (league.ste) {
      const slot = constants.slots.TE
      const players = roster.starters.filter(p => p.slot === slot)
      for (let i = 0; i < league.ste; i++) {
        const { player } = players[i] || {}
        rows.push(
          <ScoreboardPlayer key={`${slot}${i}`} {...{ playerId: player, slot, roster }} />
        )
      }
    }

    if (league.sk) {
      const slot = constants.slots.K
      const players = roster.starters.filter(p => p.slot === slot)
      for (let i = 0; i < league.sk; i++) {
        const { player } = players[i] || {}
        rows.push(
          <ScoreboardPlayer key={`${slot}${i}`} {...{ playerId: player, slot, roster }} />
        )
      }
    }

    if (league.sdst) {
      const slot = constants.slots.DST
      const players = roster.starters.filter(p => p.slot === slot)
      for (let i = 0; i < league.sdst; i++) {
        const { player } = players[i] || {}
        rows.push(
          <ScoreboardPlayer key={`${slot}${i}`} {...{ playerId: player, slot, roster }} />
        )
      }
    }

    const classNames = ['scoreboard__team']
    classNames.push(type)

    return (
      <div className={classNames.join(' ')}>
        <div className='scoreboard__team-head'>
          <div
            className='scoreboard__team-banner'
            style={{
              backgroundColor: `#${team.pc}`
            }}
          />
          <div
            className='scoreboard__team-line'
            style={{
              backgroundColor: `#${team.ac}`
            }}
          />
          <TeamImage tid={team.uid} />
          <TeamName tid={team.uid} />
          <div className='scoreboard__team-score metric'>0.0</div>
        </div>
        <div className='scoreboard__team-roster'>
          {rows}
        </div>
      </div>
    )
  }
}
