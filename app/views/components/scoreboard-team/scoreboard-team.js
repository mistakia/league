import React, { useMemo, useCallback } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import ScoreboardPlayer from '@components/scoreboard-player'
import TeamName from '@components/team-name'
import TeamImage from '@components/team-image'

import './scoreboard-team.styl'
import { current_season, roster_slot_types } from '@constants'

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
    () => team.uid === matchup.home_team_id,
    [team.uid, matchup.home_team_id]
  )
  const final_projection = useMemo(
    () => (is_home ? matchup.home_projection : matchup.away_projection),
    [is_home, matchup.home_projection, matchup.away_projection]
  )
  const is_final = useMemo(
    () =>
      matchup.week < current_season.week ||
      matchup.season_year < current_season.year,
    [matchup.week, matchup.season_year]
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
    // Each league field is paired with its roster_slot_types key directly --
    // the field names no longer share the single-letter-prefix shape
    // (`s` + slot key) that let this derive slot_key from the field name.
    const league_slots = [
      { field: 'starter_slots_quarterback', slot_key: 'QB' },
      { field: 'starter_slots_running_back', slot_key: 'RB' },
      { field: 'starter_slots_wide_receiver', slot_key: 'WR' },
      {
        field: 'starter_slots_running_back_wide_receiver_flex',
        slot_key: 'RBWR'
      },
      {
        field: 'starter_slots_running_back_wide_receiver_tight_end_flex',
        slot_key: 'RBWRTE'
      },
      { field: 'starter_slots_superflex', slot_key: 'QBRBWRTE' },
      { field: 'starter_slots_wide_receiver_tight_end_flex', slot_key: 'WRTE' },
      { field: 'starter_slots_tight_end', slot_key: 'TE' },
      { field: 'starter_slots_kicker', slot_key: 'K' },
      { field: 'starter_slots_defense_special_teams', slot_key: 'DST' }
    ]
    for (const { field, slot_key } of league_slots) {
      if (league[field]) {
        const slot_id = roster_slot_types[slot_key]
        result = result.concat(generateRows(slot_id, league[field]))
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
            backgroundColor: `#${team.primary_color || 'd0d0d0'}`
          }}
        />
        <div
          className='scoreboard__team-line'
          style={{
            backgroundColor: `#${team.accent_color || 'd0d0d0'}`
          }}
        />
        <TeamImage tid={team.uid} year={matchup.season_year} />
        <TeamName tid={team.uid} year={matchup.season_year} />
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
