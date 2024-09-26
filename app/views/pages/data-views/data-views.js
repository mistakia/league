import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import { useLocation, NavLink } from 'react-router-dom'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Table from 'react-table/index.js'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import generate_view_id from 'react-table/src/utils/generate-view-id.js'

import PageLayout from '@layouts/page'
import Loading from '@components/loading'
import { Team } from '@core/teams'
import { get_string_from_object } from '@libs-shared'
import { shorten_url } from '@core/utils'

import './data-views.styl'

const fetch_more = () => {}

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
  reset_data_view_cache
}) {
  const location = useLocation()

  useEffect(() => {
    load_data_views()
  }, [load_data_views])

  useEffect(() => {
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
    } else {
      data_view_changed(selected_data_view, {
        view_state_changed: true
      })
    }
  }, [location, data_view_changed]) // eslint-disable-line react-hooks/exhaustive-deps

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
      class_params[`draft-order-${team.get('do')}`] = true
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

  const body = isPending ? (
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
        on_view_change={on_view_change}
        on_save_view={save_data_view}
        table_state={selected_data_view.table_state}
        saved_table_state={selected_data_view.saved_table_state}
        all_columns={data_views_fields}
        selected_view={selected_data_view}
        select_view={set_selected_data_view}
        fetch_more={fetch_more} // TODO
        total_rows_fetched={players.size}
        total_row_count={players.size} // TODO get from server
        is_fetching_more={selected_data_view.is_fetching} // TODO
        is_loading={selected_data_view.is_fetching}
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
  reset_data_view_cache: PropTypes.func
}
