import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Table from 'react-table/index.js'

import plays_view_fields from '@core/plays-view-fields'

import './selected-player-plays.styl'

const get_pid_column_for_position = (pos) => {
  switch (pos) {
    case 'QB':
      return 'play_passer_pid'
    case 'RB':
    case 'FB':
      return 'play_rusher_pid'
    case 'WR':
    case 'TE':
      return 'play_target_pid'
    default:
      return 'play_passer_pid'
  }
}

const get_default_columns_for_position = (pos) => {
  switch (pos) {
    case 'QB':
      return [
        'play_type',
        'play_pass_yds',
        'play_air_yards',
        'play_comp',
        'play_td',
        'play_epa',
        'play_target'
      ]
    case 'RB':
    case 'FB':
      return [
        'play_type',
        'play_rush_yds',
        'play_yards_after_contact',
        'play_td',
        'play_epa',
        'play_successful'
      ]
    case 'WR':
    case 'TE':
      return [
        'play_type',
        'play_recv_yds',
        'play_yards_after_catch',
        'play_route',
        'play_td',
        'play_epa'
      ]
    default:
      return [
        'play_type',
        'play_yds_gained',
        'play_td',
        'play_epa'
      ]
  }
}

export default function SelectedPlayerPlays({
  player_map,
  selected_player_plays_request,
  send_plays_request
}) {
  const pid = player_map.get('pid')
  const pos = player_map.get('pos')

  const columns = get_default_columns_for_position(pos)
  const table_state = {
    columns,
    prefix_columns: ['play_desc'],
    sort: [{ column_id: 'play_sequence', desc: true }],
    where: []
  }

  useEffect(() => {
    if (!pid) return

    const pid_column = get_pid_column_for_position(pos)

    send_plays_request({
      columns,
      prefix_columns: ['play_desc'],
      where: [
        {
          column_id: pid_column,
          operator: '=',
          value: pid
        }
      ],
      sort: [{ column_id: 'play_sequence', desc: true }],
      source: 'selected_player'
    })
  }, [pid, pos, send_plays_request])

  const plays = selected_player_plays_request.get('result').toJS()
  const status = selected_player_plays_request.get('status')
  const position = selected_player_plays_request.get('position')

  const is_loading = status === 'pending' || status === 'processing'

  const render_status = () => {
    if (status === 'pending' && position) {
      return (
        <div className='selected-player-plays__status'>
          Request queued. Position: {position}
        </div>
      )
    }

    if (status === 'processing') {
      return (
        <div className='selected-player-plays__status'>
          Loading plays...
        </div>
      )
    }

    if (status === 'error') {
      return (
        <div className='selected-player-plays__status error'>
          Error loading plays
        </div>
      )
    }

    return null
  }

  if (!pid) {
    return null
  }

  return (
    <div className='selected-player-plays'>
      {render_status()}
      <Table
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        data={plays}
        table_state={table_state}
        saved_table_state={table_state}
        all_columns={plays_view_fields}
        is_loading={is_loading}
        total_rows_fetched={plays.length}
        total_row_count={plays.length}
        disable_rank_aggregation
        disable_edit_view
      />
    </div>
  )
}

SelectedPlayerPlays.propTypes = {
  player_map: ImmutablePropTypes.map,
  selected_player_plays_request: ImmutablePropTypes.map,
  send_plays_request: PropTypes.func
}
