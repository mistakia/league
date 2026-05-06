import { connect } from 'react-redux'

import { data_views_actions } from '@core/data-views'
import { plays_views_actions } from '@core/plays-view'

import ShortUrlResolver from './short-url-resolver'

const map_dispatch_to_props = {
  data_view_changed: data_views_actions.data_view_changed,
  plays_view_changed: plays_views_actions.plays_view_changed
}

export default connect(null, map_dispatch_to_props)(ShortUrlResolver)
