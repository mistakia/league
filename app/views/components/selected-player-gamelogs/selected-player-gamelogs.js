import React, { useEffect } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import PlayerSelectedRow from '@components/player-selected-row'
import PlayerSelectedRowHeader from '@components/player-selected-row-header'

import './selected-player-gamelogs.styl'

// Fantasy stats to show in gamelogs (only total points and points added)
const GAMELOGS_FANTASY_STATS_FILTER = ['points', 'points_added']

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

export default function SelectedPlayerGamelogs({ player_map, load, years }) {
  const pid = player_map.get('pid')
  const position = player_map.get('pos')

  useEffect(() => {
    load({ pid, position })
  }, [pid, position, load])

  const snaps_config = get_snaps_config(position)

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
          <div className='row__group-head'>Snaps</div>
          <div className='row__group-body'>
            <div className='table__cell'>OFF%</div>
            {snaps_config.types.map((type) => (
              <div key={type} className='table__cell'>
                {type}
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
