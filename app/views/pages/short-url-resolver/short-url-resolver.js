import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useParams, Navigate } from 'react-router-dom'
import generate_view_id from 'react-table/src/utils/generate-view-id.js'

import PageLayout from '@layouts/page'
import Loading from '@components/loading'
import { get_shortened_url } from '@core/utils'
import parse_table_state_from_url from '@core/data-views/parse-table-state-from-url.mjs'

import DataViewsPage from '@pages/data-views'
import PlaysPage from '@pages/plays'
import resolve_short_url_chain from '@libs-shared/resolve-short-url-chain.mjs'

const STATUS_LOADING = 'loading'
const STATUS_READY = 'ready'
const STATUS_NOT_FOUND = 'not_found'

export default function ShortUrlResolver({
  data_view_changed,
  plays_view_changed
}) {
  const { hash } = useParams()
  const [status, set_status] = useState(STATUS_LOADING)
  const [target, set_target] = useState(null)

  useEffect(() => {
    let cancelled = false
    set_status(STATUS_LOADING)
    set_target(null)

    const { abort, request } = get_shortened_url({ hash })

    const fetch_url_by_hash = async (inner_hash) => {
      if (cancelled) throw new Error('cancelled')
      const { request: inner_request } = get_shortened_url({
        hash: inner_hash
      })
      const { url: inner_url } = await inner_request()
      return inner_url
    }

    const resolve = async () => {
      try {
        const { url } = await request()
        if (cancelled) return

        const url_object = await resolve_short_url_chain({
          initial_url: url,
          fetch_url_by_hash
        })
        if (cancelled) return

        const search_params = url_object.searchParams
        const parsed = parse_table_state_from_url(search_params)
        const has_table_state =
          parsed.columns.length ||
          parsed.where.length ||
          (parsed.prefix_columns.length && parsed.sort.length) ||
          Object.keys(parsed.rank_aggregation || {}).length ||
          Object.keys(parsed.scatter_plot_options || {}).length ||
          parsed.disable_scatter_plot === true

        if (
          url_object.pathname === '/data-views' ||
          url_object.pathname.startsWith('/data-views/')
        ) {
          if (has_table_state) {
            const next_table_state = {
              columns: parsed.columns,
              sort: parsed.sort,
              where: parsed.where,
              prefix_columns: parsed.prefix_columns,
              splits: parsed.splits,
              q: parsed.q,
              rank_aggregation: parsed.rank_aggregation,
              scatter_plot_options: parsed.scatter_plot_options,
              disable_scatter_plot: parsed.disable_scatter_plot
            }
            data_view_changed(
              {
                // Preserve the URL's view_id so re-shortening from a /u/<hash>
                // page produces the same canonical URL (and same hash) as the
                // original shorten. Fall back to a fresh id if the URL had
                // none.
                view_id: parsed.view_id || generate_view_id(),
                view_name: parsed.view_name,
                view_search_column_id: parsed.view_search_column_id,
                view_description: parsed.view_description,
                table_state: next_table_state,
                saved_table_state: next_table_state
              },
              { view_state_changed: true }
            )
          }
          set_target('data-views')
          set_status(STATUS_READY)
          return
        }

        if (
          url_object.pathname === '/plays' ||
          url_object.pathname.startsWith('/plays/')
        ) {
          if (has_table_state) {
            const next_table_state = {
              columns: parsed.columns,
              sort: parsed.sort,
              where: parsed.where,
              prefix_columns: parsed.prefix_columns,
              q: parsed.q,
              rank_aggregation: parsed.rank_aggregation,
              scatter_plot_options: parsed.scatter_plot_options,
              disable_scatter_plot: parsed.disable_scatter_plot
            }
            plays_view_changed(
              {
                view_id: parsed.view_id || generate_view_id(),
                view_name: parsed.view_name,
                view_description: parsed.view_description,
                table_state: next_table_state,
                saved_table_state: next_table_state
              },
              { view_state_changed: true }
            )
          }
          set_target('plays')
          set_status(STATUS_READY)
          return
        }

        set_status(STATUS_NOT_FOUND)
      } catch (error) {
        if (cancelled) return
        set_status(STATUS_NOT_FOUND)
      }
    }

    resolve()
    return () => {
      cancelled = true
      abort()
    }
  }, [hash, data_view_changed, plays_view_changed])

  if (status === STATUS_LOADING) {
    return <PageLayout body={<Loading loading />} />
  }

  if (status === STATUS_NOT_FOUND) {
    return <Navigate to='/data-views' replace />
  }

  if (target === 'plays') {
    return <PlaysPage />
  }

  return <DataViewsPage />
}

ShortUrlResolver.propTypes = {
  data_view_changed: PropTypes.func.isRequired,
  plays_view_changed: PropTypes.func.isRequired
}
