import React from 'react'
import { useNavigate } from 'react-router-dom'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { constants, get_string_from_object } from '@libs-shared'
import TeamName from '@components/team-name'
import TeamImage from '@components/team-image'

import './matchup.styl'

export default function Matchup({ matchup, teams, scoreboard }) {
  const navigate = useNavigate()
  const home = teams.find((t) => t.uid === matchup.hid) || {}
  const away = teams.find((t) => t.uid === matchup.aid) || {}
  const handleClick = () =>
    navigate(
      `/leagues/${matchup.lid}/matchups/${matchup.year}/${matchup.week}/${matchup.uid}`
    )
  const formatSpread = (value) =>
    value === 0 ? 'EVEN' : value > 0 ? `+${value}` : value

  const is_current_week =
    matchup.week === constants.season.week &&
    matchup.year === constants.season.year
  const is_final = Boolean(matchup.ap && matchup.hp)
  const home_score =
    !is_final && is_current_week ? scoreboard.home.points : matchup.hp
  const away_score =
    !is_final && is_current_week ? scoreboard.away.points : matchup.ap
  const home_proj =
    !is_final && is_current_week
      ? Math.round(scoreboard.home.projected)
      : matchup.home_projection
  const away_proj =
    !is_final && is_current_week
      ? Math.round(scoreboard.away.projected)
      : matchup.away_projection

  return (
    <div className='matchup cursor' onClick={handleClick}>
      <div className='matchup__head'>
        <div className='matchup__col metric spread'>Spread</div>
        <div className='matchup__col metric proj'>Proj</div>
        <div className='matchup__col metric score' />
      </div>
      <div
        className={get_string_from_object({
          matchup__away: true,
          winner: matchup.ap > matchup.hp
        })}
      >
        <div
          className='matchup__banner'
          style={{
            backgroundColor: `#${away.pc}`
          }}
        />
        <TeamImage tid={matchup.aid} />
        <TeamName tid={matchup.aid} />
        <div className='matchup__col metric spread'>
          {formatSpread(matchup.home_projection - matchup.away_projection)}
        </div>
        <div className='matchup__col metric proj'>{away_proj}</div>
        <div className='matchup__col metric score'>{away_score || '-'}</div>
        {matchup.ap > matchup.hp && (
          <div className='matchup__winner-arrow-left' />
        )}
      </div>
      <div
        className={get_string_from_object({
          matchup__home: true,
          winner: matchup.hp > matchup.ap
        })}
      >
        <div
          className='matchup__banner'
          style={{
            backgroundColor: `#${home.pc}`
          }}
        />
        <TeamImage tid={matchup.hid} />
        <TeamName tid={matchup.hid} />
        <div className='matchup__col metric spread'>
          {formatSpread(matchup.away_projection - matchup.home_projection)}
        </div>
        <div className='matchup__col metric proj'>{home_proj}</div>
        <div className='matchup__col metric score'>{home_score || '-'}</div>
        {matchup.hp > matchup.ap && (
          <div className='matchup__winner-arrow-left' />
        )}
      </div>
    </div>
  )
}

Matchup.propTypes = {
  matchup: ImmutablePropTypes.record,
  teams: ImmutablePropTypes.map,
  scoreboard: ImmutablePropTypes.record
}
