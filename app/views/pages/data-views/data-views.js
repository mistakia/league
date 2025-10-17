import React, { useEffect, useMemo, useCallback } from 'react'
import PropTypes from 'prop-types'
import { useLocation, NavLink, useParams, useNavigate } from 'react-router-dom'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Table from 'react-table/index.js'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import generate_view_id from 'react-table/src/utils/generate-view-id.js'

import PageLayout from '@layouts/page'
import Loading from '@components/loading'
import { Team } from '@core/teams'
import { get_string_from_object } from '@libs-shared'
import { shorten_url } from '@core/utils'
import { API_URL } from '@core/constants'

import './data-views.styl'

const get_export_api_url = ({ view_id, export_format }) => {
  return `${API_URL}/data-views/export/${view_id}/${export_format}`
}

const get_scatter_point_label = (row) => {
  return `${row.fname} ${row.lname}`
}

const get_scatter_point_image = ({ row, total_rows }) => {
  if (row.player_nfl_teams_0) {
    const size = total_rows < 50 ? 48 : 18
    return {
      url: `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/${row.player_nfl_teams_0}.png&h=${size * 4}&w=${size * 4}`,
      width: size,
      height: size
    }
  }
  return null
}

const is_scatter_plot_point_label_enabled = ({ rows }) => {
  if (!rows.length) return true

  const all_pids_are_team_abbreviations = rows.every((row) => {
    return row.pid && row.pid.length !== 25
  })

  return !all_pids_are_team_abbreviations
}

export default function DataViewsPage({
  players,
  data_views_fields,
  isPending,
  isLoggedIn,
  selected_data_view,
  data_views,
  data_view_changed,
  set_selected_data_view,
  delete_data_view,
  selected_player_pid,
  teamId,
  leagueId,
  highlight_team_ids,
  teams,
  players_percentiles,
  user_id,
  save_data_view,
  load_data_views,
  user_username,
  data_view_request,
  reset_data_view_cache,
  load_data_view
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const { view_id } = useParams()

  useEffect(() => {
    load_data_views()
    if (view_id) {
      load_data_view(view_id)
    }
  }, [load_data_views, load_data_view, view_id])

  useEffect(() => {
    if (!view_id) {
      const search_params = new URLSearchParams(location.search)
      const columns = JSON.parse(search_params.get('columns') || 'null') || []
      const sort = JSON.parse(search_params.get('sort') || 'null') || []
      const where = JSON.parse(search_params.get('where') || 'null') || []
      const prefix_columns =
        JSON.parse(search_params.get('prefix_columns') || 'null') || []
      const splits = JSON.parse(search_params.get('splits') || 'null') || []
      const view_name = search_params.get('view_name') || ''
      const view_search_column_id =
        search_params.get('view_search_column_id') || ''
      const view_description = search_params.get('view_description') || ''

      const has_table_state =
        columns.length || where.length || (prefix_columns.length && sort.length)

      // Only handle URL-based table state initialization
      // Browser state restoration and default view selection is handled by sagas
      if (has_table_state) {
        data_view_changed(
          {
            // generate a new view_id to make sure it doesn't conflict with a saved view
            view_id: generate_view_id(),
            view_name,
            view_search_column_id,
            view_description,
            table_state: {
              columns,
              sort,
              where,
              prefix_columns,
              splits
            },
            saved_table_state: {
              columns,
              sort,
              where,
              prefix_columns,
              splits
            }
          },
          {
            view_state_changed: true
          }
        )
      }
    }
  }, [location, data_view_changed, view_id])

  useEffect(() => {
    for (const column of selected_data_view.table_state.columns) {
      const column_id = typeof column === 'string' ? column : column.column_id
      const player_field = data_views_fields[column_id]
      if (player_field && player_field.load) {
        player_field.load()
      }
    }
  }, [
    data_views_fields,
    selected_data_view.view_id,
    selected_data_view.table_state.columns
  ])

  for (const player of players) {
    const is_rostered = Boolean(player.tid)

    const class_params = {
      fa: isLoggedIn && !is_rostered,
      selected: selected_player_pid === player.pid,
      rostered: teamId && player.tid === teamId
    }

    if (highlight_team_ids.includes(player.tid)) {
      const team = teams.get(player.tid, new Team())
      class_params[`draft-order-${team.get('draft_order')}`] = true
    }
    player.className = get_string_from_object(class_params)
  }

  const new_prefix_columns = [
    'player_name',
    'player_nfl_teams',
    'player_position'
  ]
  if (isLoggedIn && leagueId) {
    new_prefix_columns.push('player_league_roster_status')
  }

  const on_view_change = (data_view, view_change_params = {}) => {
    if (view_change_params.is_new_view) {
      data_view.user_id = user_id
    }
    data_view_changed(data_view, view_change_params)
  }

  const on_select_view = (args) => {
    if (view_id) {
      navigate('/data-views')
    }
    set_selected_data_view(args)
  }

  const render_request_status = () => {
    if (!data_view_request.current_request) return null

    const { status, position } = data_view_request

    if (status === 'pending' && position) {
      return (
        <div className='data-view-request-status-container'>
          Request queued. Position: {position}
        </div>
      )
    }

    if (status === 'processing') {
      return (
        <div className='data-view-request-status-container'>
          Processing request...
        </div>
      )
    }

    if (status === 'error') {
      return (
        <div className='data-view-request-status-container error'>
          Error occured while processing request
        </div>
      )
    }

    return null
  }

  // adjust the table state to remove the player_league_roster_status column if the leagueId is not set
  const filtered_table_state = useMemo(() => {
    if (leagueId && leagueId > 0) {
      return selected_data_view.table_state
    }

    return {
      ...selected_data_view.table_state,
      prefix_columns: selected_data_view.table_state?.prefix_columns?.filter(
        (column) => column !== 'player_league_roster_status'
      ) || []
    }
  }, [selected_data_view.table_state, leagueId])

  const filtered_saved_table_state = useMemo(() => {
    if (leagueId && leagueId > 0) {
      return selected_data_view.saved_table_state
    }

    return {
      ...selected_data_view.saved_table_state,
      prefix_columns:
        selected_data_view.saved_table_state?.prefix_columns?.filter(
          (column) => column !== 'player_league_roster_status'
        ) || []
    }
  }, [selected_data_view.saved_table_state, leagueId])

  const fetch_more = useCallback(() => {
    // Don't fetch more if we're already loading or fetching more
    const is_fetching =
      data_view_request.status === 'pending' ||
      data_view_request.status === 'processing'
    const has_offset = Boolean(selected_data_view.table_state.offset)

    // If we're already fetching more data (not initial load), don't fetch again
    if (is_fetching && has_offset) {
      return
    }

    const current_offset = selected_data_view.table_state.offset || 0
    const current_limit = selected_data_view.table_state.limit || 500
    const new_offset = current_offset + current_limit

    // Check if we've already fetched all data
    const total_count = data_view_request.metadata?.total_count || 0
    if (total_count > 0 && new_offset >= total_count) {
      return // Don't fetch more if we've reached the total count
    }

    // Update the data view with new offset
    const updated_data_view = {
      ...selected_data_view,
      table_state: {
        ...selected_data_view.table_state,
        offset: new_offset
      }
    }

    data_view_changed(updated_data_view, {
      view_state_changed: true,
      append_results: true // Flag to indicate we should append results instead of replacing
    })
  }, [selected_data_view, data_view_request, data_view_changed])

  const is_view_loading =
    isPending || (view_id && selected_data_view.view_id !== view_id)

  const is_fetching_more =
    data_view_request.status === 'pending' ||
    data_view_request.status === 'processing'
      ? Boolean(selected_data_view.table_state.offset)
      : false

  const is_loading =
    (data_view_request.status === 'pending' ||
      data_view_request.status === 'processing') &&
    !selected_data_view.table_state.offset

  const body = is_view_loading ? (
    <Loading loading />
  ) : (
    <div className='players__table'>
      {render_request_status()}
      <div className='players__table-help'>
        <InfoOutlinedIcon />
        <span>
          Visit the <NavLink to='/guides/data-views'>guide</NavLink> to learn
          how to build data views.
        </span>
      </div>
      <Table
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        data={players}
        metadata={data_view_request.metadata}
        on_view_change={on_view_change}
        on_save_view={save_data_view}
        table_state={filtered_table_state}
        saved_table_state={filtered_saved_table_state}
        all_columns={data_views_fields}
        selected_view={selected_data_view}
        select_view={on_select_view}
        fetch_more={fetch_more}
        total_rows_fetched={players.length}
        total_row_count={
          data_view_request.metadata?.total_count || players.length
        }
        is_fetching_more={is_fetching_more}
        is_loading={is_loading}
        is_selected_view_editable={
          isLoggedIn && selected_data_view.user_id === user_id
        }
        views={data_views}
        delete_view={delete_data_view}
        disable_rank_aggregation
        percentiles={players_percentiles}
        disable_edit_view={!isLoggedIn} // TODO check if user has permission to edit
        enable_duplicate_column_ids
        new_view_prefix_columns={new_prefix_columns}
        shorten_url={shorten_url}
        table_username={user_username}
        reset_cache={reset_data_view_cache}
        get_export_api_url={get_export_api_url}
        get_scatter_point_label={get_scatter_point_label}
        get_scatter_point_image={get_scatter_point_image}
        is_scatter_plot_point_label_enabled={
          is_scatter_plot_point_label_enabled
        }
      />
    </div>
  )

  return <PageLayout {...{ body }} />
}

DataViewsPage.propTypes = {
  players: PropTypes.array,
  isPending: PropTypes.bool,
  isLoggedIn: PropTypes.bool,
  data_views_fields: PropTypes.object,
  selected_data_view: PropTypes.object,
  data_views: PropTypes.array,
  data_view_changed: PropTypes.func,
  set_selected_data_view: PropTypes.func,
  delete_data_view: PropTypes.func,
  selected_player_pid: PropTypes.string,
  teamId: PropTypes.number,
  leagueId: PropTypes.number,
  highlight_team_ids: ImmutablePropTypes.list,
  teams: ImmutablePropTypes.map,
  players_percentiles: PropTypes.object,
  user_id: PropTypes.number,
  save_data_view: PropTypes.func,
  load_data_views: PropTypes.func,
  user_username: PropTypes.string,
  data_view_request: PropTypes.object,
  reset_data_view_cache: PropTypes.func,
  load_data_view: PropTypes.func
}
