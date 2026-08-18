import React from 'react'
import { useNavigate } from 'react-router-dom'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { get_string_from_object } from '@libs-shared'
import TeamName from '@components/team-name'
import TeamImage from '@components/team-image'

import './matchup.styl'
import { current_season } from '@constants'

export default function Matchup({ matchup, teams, scoreboard }) {
  const navigate = useNavigate()
  const home = teams.find((t) => t.team_id === matchup.home_team_id) || {}
  const away = teams.find((t) => t.team_id === matchup.away_team_id) || {}
  const handleClick = () =>
    navigate(
      `/leagues/${matchup.lid}/matchups/${matchup.season_year}/${matchup.week}/${matchup.matchup_id}`
    )
  const formatSpread = (value) =>
    value === 0 ? 'EVEN' : value > 0 ? `+${value}` : value

  const is_current_week =
    matchup.week === current_season.week &&
    matchup.season_year === current_season.year
  const is_final = Boolean(matchup.away_points && matchup.home_points)
  const home_score =
    !is_final && is_current_week ? scoreboard.home.points : matchup.home_points
  const away_score =
    !is_final && is_current_week ? scoreboard.away.points : matchup.away_points
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
          winner: matchup.away_points > matchup.home_points
        })}
      >
        <div
          className='matchup__banner'
          style={{
            backgroundColor: `#${away.primary_color}`
          }}
        />
        <TeamImage tid={matchup.away_team_id} year={matchup.season_year} />
        <TeamName tid={matchup.away_team_id} year={matchup.season_year} />
        <div className='matchup__col metric spread'>
          {formatSpread(matchup.home_projection - matchup.away_projection)}
        </div>
        <div className='matchup__col metric proj'>{away_proj}</div>
        <div className='matchup__col metric score'>{away_score || '-'}</div>
        {matchup.away_points > matchup.home_points && (
          <div className='matchup__winner-arrow-left' />
        )}
      </div>
      <div
        className={get_string_from_object({
          matchup__home: true,
          winner: matchup.home_points > matchup.away_points
        })}
      >
        <div
          className='matchup__banner'
          style={{
            backgroundColor: `#${home.primary_color}`
          }}
        />
        <TeamImage tid={matchup.home_team_id} year={matchup.season_year} />
        <TeamName tid={matchup.home_team_id} year={matchup.season_year} />
        <div className='matchup__col metric spread'>
          {formatSpread(matchup.away_projection - matchup.home_projection)}
        </div>
        <div className='matchup__col metric proj'>{home_proj}</div>
        <div className='matchup__col metric score'>{home_score || '-'}</div>
        {matchup.home_points > matchup.away_points && (
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
