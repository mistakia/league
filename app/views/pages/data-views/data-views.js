import React, { useEffect, useMemo, useCallback, useState } from 'react'
import PropTypes from 'prop-types'
import { useLocation, useParams, useNavigate } from 'react-router-dom'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Table from 'react-table/index.js'
import generate_view_id from 'react-table/src/utils/generate-view-id.js'

import PageLayout from '@layouts/page'
import Loading from '@components/loading'
import ClearDataViewCacheConfirmation from '@components/clear-data-view-cache-confirmation'
import { Team } from '@core/teams'
import {
  get_string_from_object,
  get_team_color,
  get_position_color
} from '@libs-shared'
import get_split_label_suffix from '@libs-shared/get-split-label-suffix.mjs'
import parse_table_state_from_url from '@core/data-views/parse-table-state-from-url.mjs'
import { derive_auto_tags } from '@core/data-views/derive-auto-tags'
import { nfl_team_abbreviations } from '@constants'
import { shorten_url } from '@core/utils'
import { API_URL } from '@core/constants'
import DataViewFilterChips from '@components/data-view-filter-chips'
import DataViewNotices from '@components/data-view-notices'
import {
  ROW_GRAIN_DEFAULTS,
  ROW_GRAIN_OPTIONS
} from '@core/data-views/row-grain-defaults'

import './data-views.styl'

const get_export_api_url = ({ view_id, export_format }) => {
  return `${API_URL}/data-views/export/${view_id}/${export_format}`
}

const get_scatter_point_label = (row) => {
  return `${row.fname} ${row.lname}`
}

const get_scatter_point_image = ({ row, total_rows }) => {
  if (
    row.player_nfl_teams_0 &&
    nfl_team_abbreviations.includes(row.player_nfl_teams_0)
  ) {
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
  load_data_view,
  revert_data_view,
  clear_local_view_cache,
  // View organization props (B14)
  favorite_view_ids,
  tags_by_view_id,
  on_toggle_favorite,
  on_add_user_tag,
  on_remove_user_tag
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const { view_id } = useParams()
  const [cache_clear_dialog_open, set_cache_clear_dialog_open] = useState(false)
  const [filter_controls_open, set_filter_controls_open] = useState(false)

  useEffect(() => {
    load_data_views()
    if (view_id) {
      load_data_view(view_id)
    }
  }, [load_data_views, load_data_view, view_id])

  useEffect(() => {
    if (!view_id) {
      const search_params = new URLSearchParams(location.search)
      const {
        columns,
        prefix_columns,
        where,
        sort,
        splits,
        row_grain,
        q,
        rank_aggregation,
        scatter_plot_options,
        disable_scatter_plot,
        view_name,
        view_search_column_id,
        view_description
      } = parse_table_state_from_url(search_params)

      const has_table_state =
        columns.length ||
        where.length ||
        (prefix_columns.length && sort.length) ||
        Object.keys(rank_aggregation || {}).length ||
        Object.keys(scatter_plot_options || {}).length ||
        disable_scatter_plot === true

      // Only handle URL-based table state initialization
      // Browser state restoration and default view selection is handled by sagas
      if (has_table_state) {
        const next_table_state = {
          columns,
          sort,
          where,
          prefix_columns,
          splits,
          row_grain,
          q,
          rank_aggregation,
          scatter_plot_options,
          disable_scatter_plot
        }
        data_view_changed(
          {
            // generate a new view_id to make sure it doesn't conflict with a saved view
            view_id: generate_view_id(),
            view_name,
            view_search_column_id,
            view_description,
            table_state: next_table_state,
            saved_table_state: next_table_state
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

  const current_row_grain = (selected_data_view.table_state.row_grain || [
    'player'
  ])[0]

  const on_row_grain_change = useCallback(
    (next_row_grain) => {
      if (next_row_grain === current_row_grain) return
      const prev_table_state = selected_data_view.table_state
      const row_grain_defaults = ROW_GRAIN_DEFAULTS[next_row_grain]
      const next_prefix_columns = row_grain_defaults
        ? row_grain_defaults.prefix_columns
        : prev_table_state.prefix_columns

      const is_compatible = (column_id) => {
        const field = data_views_fields[column_id]
        if (!field || !Array.isArray(field.row_grains)) return true
        return field.row_grains.includes(next_row_grain)
      }
      const item_column_id = (item) =>
        typeof item === 'string' ? item : item?.column_id
      const filter_items = (items) =>
        (items || []).filter((item) => is_compatible(item_column_id(item)))

      const next_table_state = {
        ...prev_table_state,
        row_grain: [next_row_grain],
        prefix_columns: next_prefix_columns,
        columns: filter_items(prev_table_state.columns),
        where: filter_items(prev_table_state.where),
        sort: filter_items(prev_table_state.sort)
      }
      on_view_change(
        { ...selected_data_view, table_state: next_table_state },
        { view_state_changed: true }
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current_row_grain, selected_data_view, data_views_fields, data_view_changed]
  )

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
        <div className='view-request-status-container'>
          Request queued. Position: {position}
        </div>
      )
    }

    if (status === 'processing') {
      return (
        <div className='view-request-status-container'>
          Processing request...
        </div>
      )
    }

    if (status === 'error') {
      return (
        <div className='view-request-status-container error'>
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
      prefix_columns:
        selected_data_view.table_state?.prefix_columns?.filter(
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

  const point_color_mode =
    filtered_table_state.scatter_plot_options?.point_color_mode

  const get_scatter_point_color = useCallback(
    (row) => {
      if (point_color_mode === 'team') {
        return get_team_color({ abbr: row.player_nfl_teams_0, key: 'primary' })
      }
      if (point_color_mode === 'position') {
        return get_position_color(row.pos)
      }
      return undefined
    },
    [point_color_mode]
  )

  const current_splits = useMemo(
    () => filtered_table_state.splits || [],
    [filtered_table_state.splits]
  )

  const get_split_label_suffix_cb = useCallback(
    (row) => get_split_label_suffix(current_splits, row),
    [current_splits]
  )

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
    <div className='page-table__container'>
      {render_request_status()}
      {cache_clear_dialog_open && (
        <ClearDataViewCacheConfirmation
          onClose={() => set_cache_clear_dialog_open(false)}
          clear_local_view_cache={clear_local_view_cache}
        />
      )}
      <Table
        controls_extension={
          <>
            <DataViewFilterChips
              set_filter_controls_open={set_filter_controls_open}
            />
            <DataViewNotices />
          </>
        }
        clear_local_cache={() => set_cache_clear_dialog_open(true)}
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        data={players}
        filter_controls_open={filter_controls_open}
        set_filter_controls_open={set_filter_controls_open}
        metadata={data_view_request.metadata}
        on_view_change={on_view_change}
        on_save_view={save_data_view}
        row_grain_options={ROW_GRAIN_OPTIONS}
        on_row_grain_change={on_row_grain_change}
        table_state={filtered_table_state}
        saved_table_state={filtered_saved_table_state}
        on_revert_view={revert_data_view}
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
        get_scatter_point_color={
          point_color_mode ? get_scatter_point_color : null
        }
        get_scatter_point_label_suffix={
          current_splits.length ? get_split_label_suffix_cb : null
        }
        is_scatter_plot_point_label_enabled={
          is_scatter_plot_point_label_enabled
        }
        favorite_view_ids={favorite_view_ids}
        tags_by_view_id={tags_by_view_id}
        on_toggle_favorite={on_toggle_favorite}
        on_add_user_tag={on_add_user_tag}
        on_remove_user_tag={on_remove_user_tag}
        derive_auto_tags={derive_auto_tags}
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
  load_data_view: PropTypes.func,
  revert_data_view: PropTypes.func,
  clear_local_view_cache: PropTypes.func,
  // View organization props (B14) — all optional with no-op defaults
  favorite_view_ids: PropTypes.object,
  tags_by_view_id: PropTypes.object,
  on_toggle_favorite: PropTypes.func,
  on_add_user_tag: PropTypes.func,
  on_remove_user_tag: PropTypes.func
}
