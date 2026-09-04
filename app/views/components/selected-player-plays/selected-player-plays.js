import React, { useEffect, useMemo, useState, useCallback } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { List } from 'immutable'
import Table from 'react-table/index.js'

import plays_view_fields from '@core/plays-view-fields'
import derive_plays_percentile_stats from '@core/plays-view/derive-plays-percentile-stats.mjs'
import { current_season } from '#constants'
import { calculatePercentiles } from '#libs-shared'

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
      return ['play_type', 'play_yds_gained', 'play_td', 'play_epa']
  }
}

// The plays view defaults its year to the last COMPLETED NFL season when the
// request carries no play_year (see libs-server/plays-view/
// get-plays-view-results.mjs), which is the right default for the plays page
// and the wrong one here: a player whose last snap was two seasons ago gets an
// empty table with nothing saying why. Seasonlogs are the player's own record
// of which seasons they have stats in, and the parent drawer already loads
// them for its header, so the newest one is free.
const get_default_year = (player_seasonlogs) => {
  const years = player_seasonlogs
    .map((seasonlog) => Number(seasonlog.season_year))
    .filter(Boolean)

  return years.size ? years.max() : current_season.last_completed_season_year
}

const build_default_table_state = ({ pos, year }) => ({
  columns: get_default_columns_for_position(pos),
  prefix_columns: ['play_film_url', 'play_week', 'play_desc'],
  where: [
    {
      column_id: 'play_year',
      operator: '=',
      value: String(year)
    }
  ],
  sort: [
    { column_id: 'play_week', desc: true },
    { column_id: 'play_game_timestamp', desc: true },
    { column_id: 'play_sequence', desc: false }
  ]
})

export default function SelectedPlayerPlays({
  player_map,
  player_seasonlogs = new List(),
  selected_player_plays_request,
  send_plays_request
}) {
  const pid = player_map.get('pid')
  const pos = player_map.get('primary_position')
  const pid_column = get_pid_column_for_position(pos)

  const default_year = useMemo(
    () => get_default_year(player_seasonlogs),
    [player_seasonlogs]
  )

  const default_table_state = useMemo(
    () => build_default_table_state({ pos, year: default_year }),
    [pos, default_year]
  )

  const [table_state, set_table_state] = useState(default_table_state)

  // Reset to the defaults whenever the player (or the season we resolved for
  // them) changes. The drawer is reused across players, so a table state left
  // over from the last one would carry that player's position columns and
  // season filter into this one.
  useEffect(() => {
    set_table_state(default_table_state)
  }, [pid, default_table_state])

  useEffect(() => {
    if (!pid) return

    // The pid filter is the identity of this table rather than a filter the
    // user chose, so it is re-asserted on every request instead of living in
    // table_state where the filter manager could drop it.
    const where = [
      ...(table_state.where || []).filter(
        (item) => item.column_id !== pid_column
      ),
      {
        column_id: pid_column,
        operator: '=',
        value: pid
      }
    ]

    send_plays_request({
      columns: table_state.columns,
      prefix_columns: table_state.prefix_columns,
      where,
      sort: table_state.sort,
      source: 'selected_player'
    })
  }, [pid, pid_column, table_state, send_plays_request])

  const on_view_change = useCallback((data_view) => {
    set_table_state(data_view.table_state)
  }, [])

  // Memoized on the Immutable list rather than converted inline, so the rows
  // are a stable reference across renders. The percentile memo below depends on
  // them, and a fresh array every render would defeat it.
  const plays_result = selected_player_plays_request.get('result')
  const plays = useMemo(() => plays_result.toJS(), [plays_result])
  const status = selected_player_plays_request.get('status')
  const position = selected_player_plays_request.get('position')
  const metadata = selected_player_plays_request.get('metadata')

  const is_loading = status === 'pending' || status === 'processing'

  // The cohort here is this player's own plays, so the shading reads as "which
  // of his snaps were the good ones" rather than as a league-wide comparison.
  const percentiles = useMemo(() => {
    const { percentile_stat_keys, reverse_percentile_stats } =
      derive_plays_percentile_stats({
        table_state_columns: table_state.columns,
        plays_view_fields
      })

    return calculatePercentiles({
      items: plays,
      stats: percentile_stat_keys,
      reverse_percentile_stats
    })
  }, [plays, table_state.columns])

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
        <div className='selected-player-plays__status'>Loading plays...</div>
      )
    }

    if (status === 'error') {
      return (
        <div className='selected-player-plays__status error'>
          Error loading plays
        </div>
      )
    }

    // Gated on `completed`, not on `!is_loading`: a null status means the
    // request never ran, and claiming "no plays" for that reads as an answer
    // when it is the absence of one.
    if (status === 'completed' && !plays.length) {
      return (
        <div className='selected-player-plays__status'>
          No plays for the selected season
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
        metadata={metadata}
        table_state={table_state}
        saved_table_state={default_table_state}
        on_view_change={on_view_change}
        all_columns={plays_view_fields}
        is_loading={is_loading}
        total_rows_fetched={plays.length}
        total_row_count={metadata?.total_count || plays.length}
        percentiles={percentiles}
        disable_rank_aggregation
        disable_edit_view
      />
    </div>
  )
}

SelectedPlayerPlays.propTypes = {
  player_map: ImmutablePropTypes.map,
  player_seasonlogs: ImmutablePropTypes.list,
  selected_player_plays_request: ImmutablePropTypes.map,
  send_plays_request: PropTypes.func
}
