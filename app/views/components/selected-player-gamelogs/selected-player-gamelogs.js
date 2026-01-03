import React, { useEffect, useState } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import PlayerSelectedRow from '@components/player-selected-row'
import PlayerSelectedRowHeader from '@components/player-selected-row-header'

import './selected-player-gamelogs.styl'

// Fantasy stats to show in gamelogs (only total points and points added)
const GAMELOGS_FANTASY_STATS_FILTER = ['points', 'points_added']

const QUARTER_LABELS = ['Q1', 'Q2', 'Q3', 'Q4']

const get_snaps_config = (pos) => {
  switch (pos) {
    case 'DST':
    case 'K':
      return {
        types: ['DEF', 'ST'],
        fields: ['snaps_def', 'snaps_st']
      }
    case 'QB':
      return {
        types: ['OFF', 'PASS', 'RUSH'],
        fields: ['snaps_off', 'snaps_pass', 'snaps_rush']
      }
    case 'RB':
      return {
        types: ['OFF', 'PASS', 'RUSH', 'ST'],
        fields: ['snaps_off', 'snaps_pass', 'snaps_rush', 'snaps_st']
      }
    case 'WR':
    case 'TE':
      return {
        types: ['OFF', 'REC', 'RUSH', 'ST'],
        fields: ['snaps_off', 'snaps_pass', 'snaps_rush', 'snaps_st']
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
  const position = player_map.get('pos')
  const [show_quarter_snaps, set_show_quarter_snaps] = useState(false)
  const [show_quarter_pct, set_show_quarter_pct] = useState(false)

  useEffect(() => {
    load({ pid, position })
  }, [pid, position, load])

  const handle_toggle_quarter_snaps = () => {
    set_show_quarter_snaps(!show_quarter_snaps)
  }

  const handle_toggle_quarter_pct = () => {
    set_show_quarter_pct(!show_quarter_pct)
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
      const snaps_off_pct = game.snaps_off_pct
      const lead = (
        <>
          <div className='table__cell metric sticky__column game__day'>
            {game.day}
          </div>
          <div className='table__cell metric sticky__column sticky__two game__week'>
            {game.week}
          </div>
          <div className='table__cell metric'>{game.opp}</div>
          <div className='row__group'>
            <div className='row__group-body'>
              <div className='table__cell metric'>
                {(game.points || 0).toFixed(1)}
              </div>
              <div className='table__cell metric'>
                {game.points_added ? game.points_added.toFixed(1) : '-'}
              </div>
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>
              <div className='table__cell metric'>
                {snaps_off_pct != null
                  ? `${(snaps_off_pct * 100).toFixed(0)}%`
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
                  const snap_pct_field = `q${quarter_num}_snaps_${quarter_snap_type}_pct`
                  const snap_count = game[snap_count_field]
                  const snap_pct = game[snap_pct_field]
                  const pct_value =
                    snap_pct != null ? (snap_pct * 100).toFixed(0) : null
                  const background_opacity =
                    snap_pct != null ? Math.min(snap_pct * 0.6, 0.6) : 0

                  const display_value = show_quarter_pct
                    ? pct_value != null
                      ? `${pct_value}%`
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
            <div className='table__cell'>Pts+</div>
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
                    onClick={handle_toggle_quarter_pct}
                  >
                    {show_quarter_pct ? '%' : '#'}
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
