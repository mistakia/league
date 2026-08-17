import React, { useEffect, useState } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import PlayerSelectedRow from '@components/player-selected-row'
import PlayerSelectedRowHeader from '@components/player-selected-row-header'

import './selected-player-gamelogs.styl'

// Gamelogs render their own fantasy group in the lead, ahead of the snaps
// columns, so the generic stat row must contribute none of its own. Passing the
// full set here duplicated points and points added in every row.
const GAMELOGS_FANTASY_STATS_FILTER = []

const QUARTER_LABELS = ['Q1', 'Q2', 'Q3', 'Q4']

const get_snaps_config = (pos) => {
  switch (pos) {
    case 'DST':
    case 'K':
      return {
        types: ['DEF', 'ST'],
        fields: ['snaps_defense', 'snaps_special_teams']
      }
    case 'QB':
      return {
        types: ['OFF', 'PASS', 'RUSH'],
        fields: ['snaps_offense', 'snaps_pass', 'snaps_rush']
      }
    case 'RB':
      return {
        types: ['OFF', 'PASS', 'RUSH', 'ST'],
        fields: [
          'snaps_offense',
          'snaps_pass',
          'snaps_rush',
          'snaps_special_teams'
        ]
      }
    case 'WR':
    case 'TE':
      return {
        types: ['OFF', 'REC', 'RUSH', 'ST'],
        fields: [
          'snaps_offense',
          'snaps_pass',
          'snaps_rush',
          'snaps_special_teams'
        ]
      }
    default:
      return { types: [], fields: [] }
  }
}

// Get quarter snap fields based on position (offensive vs defensive)
const get_quarter_snap_type = (pos) => {
  const defensive_positions = ['DST', 'LB', 'DL', 'DB']
  return defensive_positions.includes(pos) ? 'def' : 'off'
}

export default function SelectedPlayerGamelogs({ player_map, load, years }) {
  const pid = player_map.get('pid')
  const position = player_map.get('primary_position')
  const [show_quarter_snaps, set_show_quarter_snaps] = useState(false)
  const [show_quarter_percentage, set_show_quarter_percentage] = useState(false)

  useEffect(() => {
    load({ pid, position })
  }, [pid, position, load])

  const handle_toggle_quarter_snaps = () => {
    set_show_quarter_snaps(!show_quarter_snaps)
  }

  const handle_toggle_quarter_percentage = () => {
    set_show_quarter_percentage(!show_quarter_percentage)
  }

  const snaps_config = get_snaps_config(position)
  const quarter_snap_type = get_quarter_snap_type(position)

  const rows = []
  const sorted_years = Object.keys(years).sort((a, b) => b - a)
  sorted_years.forEach((year, yearIndex) => {
    rows.push(
      <div
        key={yearIndex}
        className='header__row sticky__column selected-player-gamelogs-year'
      >
        {year}
      </div>
    )
    const gamelogs = years[year]
    gamelogs.forEach((game, gameIndex) => {
      const snaps_offense_percentage = game.snaps_offense_percentage
      const lead = (
        <>
          <div className='table__cell metric sticky__column game__day'>
            {game.day}
          </div>
          <div className='table__cell metric sticky__column sticky__two game__week'>
            {game.week}
          </div>
          <div className='table__cell metric'>{game.opponent_nfl_team}</div>
          <div className='row__group'>
            <div className='row__group-body'>
              <div className='table__cell metric'>
                {(game.points || 0).toFixed(1)}
              </div>
              <div className='table__cell metric'>
                {game.points_added_earned != null
                  ? game.points_added_earned.toFixed(1)
                  : '-'}
              </div>
              <div className='table__cell metric'>
                {game.points_added_net != null
                  ? game.points_added_net.toFixed(1)
                  : '-'}
              </div>
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>
              <div className='table__cell metric'>
                {snaps_offense_percentage != null
                  ? `${(snaps_offense_percentage * 100).toFixed(0)}%`
                  : '-'}
              </div>
              {snaps_config.fields.map((field) => (
                <div key={field} className='table__cell metric'>
                  {game[field] ?? '-'}
                </div>
              ))}
              {show_quarter_snaps &&
                QUARTER_LABELS.map((label, index) => {
                  const quarter_num = index + 1
                  const snap_count_field = `q${quarter_num}_snaps_${quarter_snap_type}`
                  const snap_percentage_field = `q${quarter_num}_snaps_${quarter_snap_type}_percentage`
                  const snap_count = game[snap_count_field]
                  const snap_percentage = game[snap_percentage_field]
                  const percentage_value =
                    snap_percentage != null
                      ? (snap_percentage * 100).toFixed(0)
                      : null
                  const background_opacity =
                    snap_percentage != null
                      ? Math.min(snap_percentage * 0.6, 0.6)
                      : 0

                  const display_value = show_quarter_percentage
                    ? percentage_value != null
                      ? `${percentage_value}%`
                      : '-'
                    : (snap_count ?? '-')

                  return (
                    <div
                      key={label}
                      className='table__cell metric'
                      style={{
                        backgroundColor: `rgba(46, 163, 221, ${background_opacity})`
                      }}
                    >
                      {display_value}
                    </div>
                  )
                })}
            </div>
          </div>
        </>
      )

      rows.push(
        <PlayerSelectedRow
          key={`${yearIndex}/${gameIndex}`}
          className={game.seas_type}
          stats={game}
          lead={lead}
          pos={position}
          fantasy_stats_filter={GAMELOGS_FANTASY_STATS_FILTER}
        />
      )
    })
  })

  return (
    <div className='selected__table'>
      <div className='selected__table-header sticky__column'>
        <div className='row__group-head'>Gamelogs</div>
      </div>
      <div className='selected__table-header sticky'>
        <div className='table__cell metric sticky__column game__day' />
        <div className='table__cell metric sticky__column sticky__two game__week'>
          Wk
        </div>
        <div className='table__cell'>Opp</div>
        <div className='row__group'>
          <div className='row__group-head'>Fantasy</div>
          <div className='row__group-body'>
            <div className='table__cell'>Pts</div>
            <div className='table__cell'>Pts+ Earned</div>
            <div className='table__cell'>Pts+ Net</div>
          </div>
        </div>
        <div className='row__group'>
          <div className='row__group-head snaps-header'>
            <span>Snaps</span>
            <div className='snaps-header-controls'>
              {show_quarter_snaps && (
                <>
                  <span
                    className='snaps-toggle-button'
                    onClick={handle_toggle_quarter_percentage}
                  >
                    {show_quarter_percentage ? '%' : '#'}
                  </span>
                  <span className='snaps-toggle-separator'>|</span>
                </>
              )}
              <span
                className='snaps-toggle-button'
                onClick={handle_toggle_quarter_snaps}
              >
                {show_quarter_snaps ? '<<' : '>>'}
              </span>
            </div>
          </div>
          <div className='row__group-body'>
            <div className='table__cell'>OFF%</div>
            {snaps_config.types.map((type) => (
              <div key={type} className='table__cell'>
                {type}
              </div>
            ))}
            {show_quarter_snaps &&
              QUARTER_LABELS.map((label) => (
                <div key={label} className='table__cell'>
                  {label}
                </div>
              ))}
          </div>
        </div>
        <PlayerSelectedRowHeader
          pos={position}
          fantasy_stats_filter={GAMELOGS_FANTASY_STATS_FILTER}
        />
      </div>
      {rows}
    </div>
  )
}

SelectedPlayerGamelogs.propTypes = {
  years: PropTypes.object,
  player_map: ImmutablePropTypes.map,
  load: PropTypes.func
}
