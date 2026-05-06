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

    const resolve = async () => {
      try {
        const { url } = await request()
        if (cancelled) return

        const url_object = new URL(url)
        const search_params = url_object.searchParams
        const parsed = parse_table_state_from_url(search_params)
        const has_table_state =
          parsed.columns.length ||
          parsed.where.length ||
          (parsed.prefix_columns.length && parsed.sort.length)

        if (
          url_object.pathname === '/data-views' ||
          url_object.pathname.startsWith('/data-views/')
        ) {
          if (has_table_state) {
            data_view_changed(
              {
                view_id: generate_view_id(),
                view_name: parsed.view_name,
                view_search_column_id: parsed.view_search_column_id,
                view_description: parsed.view_description,
                table_state: {
                  columns: parsed.columns,
                  sort: parsed.sort,
                  where: parsed.where,
                  prefix_columns: parsed.prefix_columns,
                  splits: parsed.splits
                },
                saved_table_state: {
                  columns: parsed.columns,
                  sort: parsed.sort,
                  where: parsed.where,
                  prefix_columns: parsed.prefix_columns,
                  splits: parsed.splits
                }
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
            plays_view_changed(
              {
                view_id: generate_view_id(),
                view_name: parsed.view_name,
                view_description: parsed.view_description,
                table_state: {
                  columns: parsed.columns,
                  sort: parsed.sort,
                  where: parsed.where,
                  prefix_columns: parsed.prefix_columns
                },
                saved_table_state: {
                  columns: parsed.columns,
                  sort: parsed.sort,
                  where: parsed.where,
                  prefix_columns: parsed.prefix_columns
                }
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
