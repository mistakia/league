import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import { constants } from '@libs-shared'
import ScoreboardPlayer from '@components/scoreboard-player'
import TeamName from '@components/team-name'
import TeamImage from '@components/team-image'

import './scoreboard-team.styl'

export default class ScoreboardTeam extends React.Component {
  render = () => {
    const { team, roster, league, type, scoreboard, showBench } = this.props

    const rows = []
    if (league.sqb) {
      const slot = constants.slots.QB
      const players = roster.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sqb; i++) {
        const { pid } = players[i] || {}
        rows.push(<ScoreboardPlayer key={`${slot}${i}`} {...{ pid, roster }} />)
      }
    }

    if (league.srb) {
      const slot = constants.slots.RB
      const players = roster.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.srb; i++) {
        const { pid } = players[i] || {}
        rows.push(<ScoreboardPlayer key={`${slot}${i}`} {...{ pid, roster }} />)
      }
    }

    if (league.swr) {
      const slot = constants.slots.WR
      const players = roster.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.swr; i++) {
        const { pid } = players[i] || {}
        rows.push(<ScoreboardPlayer key={`${slot}${i}`} {...{ pid, roster }} />)
      }
    }

    if (league.srbwr) {
      const slot = constants.slots.RBWR
      const players = roster.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.srbwr; i++) {
        const { pid } = players[i] || {}
        rows.push(<ScoreboardPlayer key={`${slot}${i}`} {...{ pid, roster }} />)
      }
    }

    if (league.srbwrte) {
      const slot = constants.slots.RBWRTE
      const players = roster.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.srbwrte; i++) {
        const { pid } = players[i] || {}
        rows.push(<ScoreboardPlayer key={`${slot}${i}`} {...{ pid, roster }} />)
      }
    }

    if (league.sqbrbwrte) {
      const slot = constants.slots.QBRBWRTE
      const players = roster.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sqbrbwrte; i++) {
        const { pid } = players[i] || {}
        rows.push(<ScoreboardPlayer key={`${slot}${i}`} {...{ pid, roster }} />)
      }
    }

    if (league.swrte) {
      const slot = constants.slots.WRTE
      const players = roster.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.swrte; i++) {
        const { pid } = players[i] || {}
        rows.push(<ScoreboardPlayer key={`${slot}${i}`} {...{ pid, roster }} />)
      }
    }

    if (league.ste) {
      const slot = constants.slots.TE
      const players = roster.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.ste; i++) {
        const { pid } = players[i] || {}
        rows.push(<ScoreboardPlayer key={`${slot}${i}`} {...{ pid, roster }} />)
      }
    }

    if (league.sk) {
      const slot = constants.slots.K
      const players = roster.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sk; i++) {
        const { pid } = players[i] || {}
        rows.push(<ScoreboardPlayer key={`${slot}${i}`} {...{ pid, roster }} />)
      }
    }

    if (league.sdst) {
      const slot = constants.slots.DST
      const players = roster.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sdst; i++) {
        const { pid } = players[i] || {}
        rows.push(<ScoreboardPlayer key={`${slot}${i}`} {...{ pid, roster }} />)
      }
    }

    const bench = []
    if (showBench) {
      for (const [index, rosterSlot] of roster.bench.entries()) {
        const { pid } = rosterSlot
        bench.push(<ScoreboardPlayer key={index} {...{ pid, roster }} />)
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
              backgroundColor: `#${team.pc || 'd0d0d0'}`
            }}
          />
          <div
            className='scoreboard__team-line'
            style={{
              backgroundColor: `#${team.ac || 'd0d0d0'}`
            }}
          />
          <TeamImage tid={team.uid} />
          <TeamName tid={team.uid} />
        </div>
        <div className='scoreboard__team-meta'>
          <div className='scoreboard__team-score'>
            <div className='score metric'>
              {scoreboard.points ? scoreboard.points.toFixed(2) : '-'}
            </div>
            <div className='projected metric'>
              {(scoreboard.projected || 0).toFixed(2)}
            </div>
          </div>
        </div>
        <div className='scoreboard__team-roster'>{rows}</div>
        {showBench && <div className='scoreboard__team-bench'>{bench}</div>}
      </div>
    )
  }
}

ScoreboardTeam.propTypes = {
  team: ImmutablePropTypes.record,
  roster: PropTypes.object,
  league: PropTypes.object,
  type: PropTypes.string,
  showBench: PropTypes.bool,
  scoreboard: PropTypes.object
}
