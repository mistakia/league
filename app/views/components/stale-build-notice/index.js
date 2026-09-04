import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import StaleBuildNotice from './stale-build-notice'

// Reads the socket slice with `getIn`, which is how the one other consumer of
// it reads it (app/views/pages/data-views/index.js). There is no
// `get_websocket_*` selector in app/core/selectors.js and this does not add
// one: a connected component naming a selector that does not exist resolves to
// `undefined` with no connect-time warning and no build failure, so a second
// consumer is not worth a new export nobody else asked for.
//
// The false -> true transition of `is_connected` is the deploy signal the
// component watches -- a pm2 reload drops every socket and the client
// reconnects on its own -- and the reducer already tracks it, so this needs no
// action, no saga and no slice of its own.
const map_state_to_props = createSelector(
  (state) => state.getIn(['websocket', 'is_connected']),
  (is_connected) => ({ is_connected: Boolean(is_connected) })
)

export default connect(map_state_to_props)(StaleBuildNotice)
