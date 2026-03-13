import React, { useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { useParams, useNavigate } from 'react-router-dom'
import Table from 'react-table/index.js'

import PageLayout from '@layouts/page'
import Loading from '@components/loading'
import { shorten_url } from '@core/utils'
import { API_URL } from '@core/constants'

import './plays.styl'

const get_export_api_url = ({ view_id, export_format }) => {
  return `${API_URL}/plays/views/export/${view_id}/${export_format}`
}

export default function PlaysPage({
  plays,
  plays_view_fields,
  isLoggedIn,
  selected_plays_view,
  plays_views,
  plays_view_changed,
  set_selected_plays_view,
  delete_plays_view,
  user_id,
  save_plays_view,
  load_plays_views,
  user_username,
  plays_view_request,
  reset_plays_view_cache,
  load_plays_view
}) {
  const navigate = useNavigate()
  const { view_id } = useParams()

  useEffect(() => {
    load_plays_views()
    if (view_id) {
      load_plays_view(view_id)
    }
  }, [load_plays_views, load_plays_view, view_id])

  const on_view_change = (data_view, view_change_params = {}) => {
    if (view_change_params.is_new_view) {
      data_view.user_id = user_id
    }
    plays_view_changed(data_view, view_change_params)
  }

  const on_select_view = (args) => {
    if (view_id) {
      navigate('/plays')
    }
    set_selected_plays_view(args)
  }

  const render_request_status = () => {
    if (!plays_view_request.current_request) return null

    const { status, position } = plays_view_request

    if (status === 'pending' && position) {
      return (
        <div className='plays-view-request-status-container'>
          Request queued. Position: {position}
        </div>
      )
    }

    if (status === 'processing') {
      return (
        <div className='plays-view-request-status-container'>
          Processing request...
        </div>
      )
    }

    if (status === 'error') {
      return (
        <div className='plays-view-request-status-container error'>
          Error occured while processing request
        </div>
      )
    }

    return null
  }

  const fetch_more = useCallback(() => {
    const is_fetching =
      plays_view_request.status === 'pending' ||
      plays_view_request.status === 'processing'
    const has_offset = Boolean(selected_plays_view.table_state.offset)

    if (is_fetching && has_offset) {
      return
    }

    const current_offset = selected_plays_view.table_state.offset || 0
    const current_limit = selected_plays_view.table_state.limit || 500
    const new_offset = current_offset + current_limit

    const total_count = plays_view_request.metadata?.total_count || 0
    if (total_count > 0 && new_offset >= total_count) {
      return
    }

    const updated_data_view = {
      ...selected_plays_view,
      table_state: {
        ...selected_plays_view.table_state,
        offset: new_offset
      }
    }

    plays_view_changed(updated_data_view, {
      view_state_changed: true,
      append_results: true
    })
  }, [selected_plays_view, plays_view_request, plays_view_changed])

  const is_view_loading = view_id && selected_plays_view.view_id !== view_id

  const is_fetching_more =
    plays_view_request.status === 'pending' ||
    plays_view_request.status === 'processing'
      ? Boolean(selected_plays_view.table_state.offset)
      : false

  const is_loading =
    (plays_view_request.status === 'pending' ||
      plays_view_request.status === 'processing') &&
    !selected_plays_view.table_state.offset

  const body = is_view_loading ? (
    <Loading loading />
  ) : (
    <div className='plays__table'>
      {render_request_status()}
      <Table
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        data={plays}
        metadata={plays_view_request.metadata}
        on_view_change={on_view_change}
        on_save_view={save_plays_view}
        table_state={selected_plays_view.table_state}
        saved_table_state={selected_plays_view.saved_table_state}
        all_columns={plays_view_fields}
        selected_view={selected_plays_view}
        select_view={on_select_view}
        fetch_more={fetch_more}
        total_rows_fetched={plays.length}
        total_row_count={
          plays_view_request.metadata?.total_count || plays.length
        }
        is_fetching_more={is_fetching_more}
        is_loading={is_loading}
        is_selected_view_editable={
          isLoggedIn && selected_plays_view.user_id === user_id
        }
        views={plays_views}
        delete_view={delete_plays_view}
        disable_rank_aggregation
        disable_edit_view={!isLoggedIn}
        enable_duplicate_column_ids
        shorten_url={shorten_url}
        table_username={user_username}
        reset_cache={reset_plays_view_cache}
        get_export_api_url={get_export_api_url}
      />
    </div>
  )

  return <PageLayout {...{ body }} />
}

PlaysPage.propTypes = {
  plays: PropTypes.array,
  isLoggedIn: PropTypes.bool,
  plays_view_fields: PropTypes.object,
  selected_plays_view: PropTypes.object,
  plays_views: PropTypes.array,
  plays_view_changed: PropTypes.func,
  set_selected_plays_view: PropTypes.func,
  delete_plays_view: PropTypes.func,
  user_id: PropTypes.number,
  save_plays_view: PropTypes.func,
  load_plays_views: PropTypes.func,
  user_username: PropTypes.string,
  plays_view_request: PropTypes.object,
  reset_plays_view_cache: PropTypes.func,
  load_plays_view: PropTypes.func
}
