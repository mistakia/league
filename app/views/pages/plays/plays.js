import React, { useEffect, useMemo, useCallback } from 'react'
import PropTypes from 'prop-types'
import { useLocation, useParams, useNavigate } from 'react-router-dom'
import Table from 'react-table/index.js'
import generate_view_id from 'react-table/src/utils/generate-view-id.js'

import PageLayout from '@layouts/page'
import Loading from '@components/loading'
import { shorten_url } from '@core/utils'
import { API_URL } from '@core/constants'
import parse_table_state_from_url from '@core/data-views/parse-table-state-from-url.mjs'

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
  load_plays_view,
  percentiles
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const { view_id } = useParams()

  // The URL's own table state, when it carries one. Parsed here rather than
  // inside the effect because the load effect below has to know whether the URL
  // names the view to show before it asks the saga to restore the last active
  // one.
  const url_table_state = useMemo(() => {
    if (view_id) return null

    const parsed = parse_table_state_from_url(
      new URLSearchParams(location.search)
    )
    const {
      columns,
      prefix_columns,
      where,
      sort,
      rank_aggregation,
      scatter_plot_options,
      disable_scatter_plot
    } = parsed

    const has_table_state =
      columns.length ||
      where.length ||
      (prefix_columns.length && sort.length) ||
      Object.keys(rank_aggregation || {}).length ||
      Object.keys(scatter_plot_options || {}).length ||
      disable_scatter_plot === true

    return has_table_state ? parsed : null
  }, [location.search, view_id])

  useEffect(() => {
    // Always call this, logged in or not. The saved-view LIST is owner-scoped
    // and requires auth, but selecting a view is not the same job as listing
    // one: default-view selection and browser-state restoration both hang off
    // load_plays_views, so skipping it when logged out left an anonymous
    // visitor with no view selected and therefore no results request -- the
    // page rendered its headers over an empty body indefinitely, with nothing
    // in the console and no failed request to react to. load_plays_views itself
    // decides whether to call the API. This is the same hole /data-views had,
    // fixed the same way; the two surfaces mirror each other deliberately.
    load_plays_views({ restore_last_active: !view_id && !url_table_state })
    if (view_id) {
      load_plays_view(view_id)
    }
  }, [load_plays_views, load_plays_view, view_id, url_table_state])

  useEffect(() => {
    // Only handle URL-based table state initialization. Browser state
    // restoration and default view selection are handled by the sagas.
    if (!url_table_state) return

    const {
      columns,
      prefix_columns,
      where,
      sort,
      q,
      rank_aggregation,
      scatter_plot_options,
      disable_scatter_plot,
      view_name,
      view_description
    } = url_table_state

    const next_table_state = {
      columns,
      sort,
      where,
      prefix_columns,
      q,
      rank_aggregation,
      scatter_plot_options,
      disable_scatter_plot
    }
    plays_view_changed(
      {
        view_id: generate_view_id(),
        view_name,
        view_description,
        table_state: next_table_state,
        saved_table_state: next_table_state
      },
      {
        view_state_changed: true
      }
    )
  }, [url_table_state, plays_view_changed])

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

  const fetch_more = useCallback(() => {
    const is_fetching =
      plays_view_request.status === 'pending' ||
      plays_view_request.status === 'processing'
    if (is_fetching) {
      return
    }

    // The next page starts where the loaded rows end. Deriving the cursor from
    // the result is what keeps it OUT of table_state -- storing it there is
    // what made a scroll poison the next column add, sort or filter with a
    // stale offset (see build_data_view_request_params in @core/data-views).
    const offset = plays.length
    if (!offset) {
      return
    }

    const total_count = plays_view_request.metadata?.total_count || 0
    if (total_count > 0 && offset >= total_count) {
      return
    }

    plays_view_changed(selected_plays_view, {
      view_state_changed: true,
      append_results: true,
      offset
    })
  }, [
    selected_plays_view,
    plays_view_request,
    plays.length,
    plays_view_changed
  ])

  const is_view_loading = view_id && selected_plays_view.view_id !== view_id

  // An in-flight request is a pagination one exactly when rows survived it: the
  // reducer preserves `result` on an append and clears it on a replace.
  const is_request_in_flight =
    plays_view_request.status === 'pending' ||
    plays_view_request.status === 'processing'

  const is_fetching_more = is_request_in_flight && plays.length > 0

  const is_loading = is_request_in_flight && plays.length === 0

  const body = is_view_loading ? (
    <Loading loading />
  ) : (
    <div className='page-table__container'>
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
        percentiles={percentiles}
        disable_rank_aggregation
        disable_edit_view={!isLoggedIn}
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
  load_plays_view: PropTypes.func,
  percentiles: PropTypes.object
}
