import React, { useMemo, useCallback } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import { constants } from '@libs-shared'
import ScoreboardPlayer from '@components/scoreboard-player'
import TeamName from '@components/team-name'
import TeamImage from '@components/team-image'

import './scoreboard-team.styl'

export default function ScoreboardTeam({
  team,
  roster,
  league,
  type,
  scoreboard,
  showBench
}) {
  const { matchup } = scoreboard
  const is_home = useMemo(
    () => team.uid === matchup.hid,
    [team.uid, matchup.hid]
  )
  const final_projection = useMemo(
    () => (is_home ? matchup.home_projection : matchup.away_projection),
    [is_home, matchup.home_projection, matchup.away_projection]
  )
  const is_final = useMemo(
    () =>
      matchup.week < constants.season.week ||
      matchup.year < constants.season.year,
    [matchup.week, matchup.year]
  )

  const generateRows = useCallback(
    (slot, count) => {
      const players = roster.starters.filter((p) => p.slot === slot)
      return Array.from({ length: count }, (_, i) => {
        const { pid } = players[i] || {}
        return <ScoreboardPlayer key={`${slot}${i}`} {...{ pid, roster }} />
      })
    },
    [roster]
  )

  const rows = useMemo(() => {
    let result = []
    const league_slots = [
      'sqb',
      'srb',
      'swr',
      'srbwr',
      'srbwrte',
      'sqbrbwrte',
      'swrte',
      'ste',
      'sk',
      'sdst'
    ]
    for (const slot of league_slots) {
      if (league[slot]) {
        const slot_key = slot.substring(1).toUpperCase()
        const slot_id = constants.slots[slot_key]
        result = result.concat(generateRows(slot_id, league[slot]))
      }
    }
    return result
  }, [league, generateRows])

  const bench = useMemo(() => {
    if (showBench) {
      return Array.from(roster.bench.entries(), ([index, rosterSlot]) => {
        const { pid } = rosterSlot
        return <ScoreboardPlayer key={index} {...{ pid, roster }} />
      })
    }
    return []
  }, [showBench, roster])

  const classNames = useMemo(() => {
    return ['scoreboard__team', type]
  }, [type])

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
        <TeamImage tid={team.uid} year={matchup.year} />
        <TeamName tid={team.uid} year={matchup.year} />
      </div>
      <div className='scoreboard__team-meta'>
        <div className='scoreboard__team-score'>
          <div className='score metric'>
            {scoreboard.points ? scoreboard.points.toFixed(2) : '-'}
          </div>
          <div className='projected metric'>
            {is_final
              ? final_projection
              : (scoreboard.projected || 0).toFixed(2)}
          </div>
        </div>
      </div>
      <div className='scoreboard__team-roster'>{rows}</div>
      {showBench && <div className='scoreboard__team-bench'>{bench}</div>}
    </div>
  )
}

ScoreboardTeam.propTypes = {
  team: ImmutablePropTypes.record,
  roster: PropTypes.object,
  league: PropTypes.object,
  type: PropTypes.string,
  showBench: PropTypes.bool,
  scoreboard: PropTypes.object
}
