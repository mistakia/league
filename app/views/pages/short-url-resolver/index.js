import { connect } from 'react-redux'
import { all } from 'redux-saga/effects'

import { inject_reducer, inject_saga } from '@core/store'
import {
  data_views_actions,
  data_views_reducer,
  data_view_organization_reducer,
  data_views_sagas
} from '@core/data-views'
import {
  plays_views_actions,
  plays_views_reducer,
  plays_views_sagas
} from '@core/plays-view'
import { data_view_request_reducer } from '@core/data-view-request/reducer'
import { plays_view_request_reducer } from '@core/plays-view-request/reducer'

import ShortUrlResolver from './short-url-resolver'

inject_reducer('data_views', data_views_reducer)
inject_reducer('data_view_organization', data_view_organization_reducer)
inject_reducer('data_view_request', data_view_request_reducer)
inject_reducer('plays_views', plays_views_reducer)
inject_reducer('plays_view_request', plays_view_request_reducer)
inject_saga('data_views', function* root_data_views_saga() {
  yield all(data_views_sagas)
})
inject_saga('plays_views', function* root_plays_views_saga() {
  yield all(plays_views_sagas)
})

const map_dispatch_to_props = {
  data_view_changed: data_views_actions.data_view_changed,
  plays_view_changed: plays_views_actions.plays_view_changed
}

export default connect(null, map_dispatch_to_props)(ShortUrlResolver)
